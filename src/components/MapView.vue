<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import type { LayerData } from '../types'
import { fetchRoute, featuresToPoints } from '../utils/routes'

const props = defineProps<{ layers: LayerData[]; loadingRoute?: string | null }>()

const mapContainer = ref<HTMLElement | null>(null)
const activeBaseMap = ref('google')

const simActive = ref(false)
const simPaused = ref(false)
const simSpeed = ref(1)
const simInfo = ref('')
const simProgress = ref(0)

let map: L.Map | null = null
const geoLayers = new Map<string, L.GeoJSON>()
const routeLayers = new Map<string, L.Polyline[]>()
let baseLayer: L.TileLayer | null = null
const baseLayers: Record<string, L.TileLayer> = {}

let simMarker: L.Marker | null = null
let simTrail: L.Polyline | null = null
let simAnimFrame = 0
let simPointIndex = 0
let simPoints: { lat: number; lng: number; fechaHora?: string; fecha?: string }[] = []
let simRouteCoords: [number, number][] = []
let simCoordIndex = 0
let simLastTime = 0

const canvasRenderer = L.canvas({ padding: 0.5 })

const userIcon = L.divIcon({
  className: 'sim-user-icon',
  html: `<div class="sim-pin"><svg width="28" height="28" viewBox="0 0 24 24" fill="#7c3aed" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const BASE_MAP_OPTIONS = [
  { id: 'osm', name: 'Callejero', icon: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
  { id: 'google', name: 'Google Maps', icon: '📍', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attr: '© Google' },
  { id: 'google-satellite', name: 'Google Satélite', icon: '🛰️', url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attr: '© Google' },
  { id: 'satellite', name: 'Satélite Esri', icon: '🌎', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'dark', name: 'Oscuro', icon: '🌑', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  { id: 'terrain', name: 'Terreno', icon: '⛰️', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap' },
]

function tooltipHtml(props: Record<string, unknown>, label: string): string {
  const lines: string[] = [`<strong>${label}</strong>`]
  const coords = props._coords as string | undefined
  if (coords) lines.push(`Coordenadas: ${coords}`)
  if (props.fechaHora) lines.push(`Fecha/Hora: ${props.fechaHora}`)
  if (props.fecha) lines.push(`Fecha: ${props.fecha}`)
  if (props.hora) lines.push(`Hora: ${props.hora}`)
  if (props.ubicacion) lines.push(`Ubicación: ${props.ubicacion}`)
  if (props.nombre) lines.push(`Nombre: ${props.nombre}`)
  if (props.direccion) lines.push(`Dirección: ${props.direccion}`)
  if (props.tipo || props.categoria) lines.push(`Tipo: ${props.tipo || props.categoria}`)
  if (props.numeroContacto) lines.push(`Contacto: ${props.numeroContacto}`)
  if (props.telefono) lines.push(`Teléfono: ${props.telefono}`)
  if (props.duracionSeg != null) lines.push(`Duración: ${props.duracionSeg} seg`)
  if (props.codigoSitio) lines.push(`Código sitio: ${props.codigoSitio}`)
  if (props.googleMaps) lines.push(`<a href="${props.googleMaps}" target="_blank" rel="noopener">Abrir en Google Maps</a>`)
  return lines.join('<br>')
}

function initMap() {
  if (!mapContainer.value || map) return
  map = L.map(mapContainer.value, {
    center: [21.2, -105.0],
    zoom: 9,
    zoomControl: false,
    renderer: canvasRenderer,
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  for (const opt of BASE_MAP_OPTIONS) {
    baseLayers[opt.id] = L.tileLayer(opt.url, { attribution: opt.attr, maxZoom: 19 })
  }
  baseLayer = baseLayers['google']
  baseLayer.addTo(map)
}

function syncLayers() {
  if (!map) return
  for (const [, gl] of geoLayers) map.removeLayer(gl)
  geoLayers.clear()
  const allBounds: L.LatLng[] = []
  for (const layer of props.layers) {
    if (!layer.visible || !layer.geojson?.features?.length) continue
    const gl = L.geoJSON(layer.geojson, {
      renderer: canvasRenderer,
      pointToLayer: (_feature, latlng) => {
        allBounds.push(latlng)
        return L.circleMarker(latlng, {
          radius: layer.type === 'centros' ? 7 : 6,
          fillColor: layer.color,
          color: '#fff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85,
          renderer: canvasRenderer,
        })
      },
      onEachFeature: (feature, featureLayer) => {
        const p = feature.properties || {}
        if (feature.geometry.type === 'Point') {
          const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
          p._coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        }
        featureLayer.bindTooltip(tooltipHtml(p, layer.label), {
          direction: 'top',
          className: 'custom-tooltip',
          offset: [0, -6],
        })
      },
    })
    gl.addTo(map)
    geoLayers.set(layer.id, gl)
  }
  if (allBounds.length > 0) {
    const bounds = L.latLngBounds(allBounds)
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true })
  }
}

async function drawRoute(layerId: string, geojson: GeoJSON.FeatureCollection, color: string) {
  if (!map) throw new Error('Mapa no listo')
  const legs = await fetchRoute(geojson)
  if (!legs || legs.length === 0) throw new Error('No se obtuvo ruta de Google')
  clearRoute(layerId)
  const polys: L.Polyline[] = []
  for (const leg of legs) {
    if (leg.polyline.length < 2) continue
    const poly = L.polyline(leg.polyline, { color, weight: 4, opacity: 0.9 }).addTo(map)
    polys.push(poly)
  }
  routeLayers.set(layerId, polys)
}

function setBaseMap(id: string) {
  if (!map || !baseLayers[id] || activeBaseMap.value === id) return
  map.removeLayer(baseLayer!)
  baseLayer = baseLayers[id]
  baseLayer.addTo(map)
  activeBaseMap.value = id
}

function clearRoute(layerId: string) {
  const existing = routeLayers.get(layerId) || []
  for (const pl of existing) { if (map) map.removeLayer(pl) }
  routeLayers.set(layerId, [])
}

// --- Simulation ---

function startSimulation(geojson: GeoJSON.FeatureCollection, color: string) {
  if (!map) return
  stopSimulation()

  const pts = featuresToPoints(geojson)
  pts.sort((a, b) => (a.fechaHora || a.fecha || '').localeCompare(b.fechaHora || b.fecha || ''))
  if (pts.length < 2) return

  simPoints = pts

  const allPolys = routeLayers.get(
    props.layers.find(l => l.visible && l.type === 'llamadas')?.id || ''
  ) || []
  simRouteCoords = []
  for (const poly of allPolys) {
    const latlngs = poly.getLatLngs() as L.LatLng[]
    for (const ll of latlngs) simRouteCoords.push([ll.lat, ll.lng])
  }
  if (simRouteCoords.length < 2) {
    simRouteCoords = pts.map(p => [p.lat, p.lng] as [number, number])
  }

  simMarker = L.marker([pts[0].lat, pts[0].lng], { icon: userIcon, zIndexOffset: 9999 }).addTo(map)
  simTrail = L.polyline([], { color, weight: 3, opacity: 0.7, dashArray: '6,8' }).addTo(map)

  simPointIndex = 0
  simCoordIndex = 0
  simActive.value = true
  simPaused.value = false
  simProgress.value = 0
  updateSimInfo()

  map.setView([pts[0].lat, pts[0].lng], 14, { animate: true })

  simLastTime = performance.now()
  simAnimFrame = requestAnimationFrame(animateStep)
}

function animateStep(now: number) {
  if (!simActive.value || !map || !simMarker) return
  if (simPaused.value) {
    simLastTime = now
    simAnimFrame = requestAnimationFrame(animateStep)
    return
  }

  const elapsed = now - simLastTime
  const interval = 120 / simSpeed.value

  if (elapsed >= interval) {
    simLastTime = now

    if (simRouteCoords.length > 0 && simCoordIndex < simRouteCoords.length) {
      const coord = simRouteCoords[simCoordIndex]
      simMarker.setLatLng(coord)
      simTrail!.addLatLng(coord)

      const nearestPt = findNearestPoint(coord)
      if (nearestPt >= 0) simPointIndex = nearestPt
      updateSimInfo()

      simProgress.value = Math.round((simCoordIndex / (simRouteCoords.length - 1)) * 100)

      if (simCoordIndex % 20 === 0) {
        map.panTo(coord, { animate: true, duration: 0.3 })
      }

      simCoordIndex++
    } else {
      simProgress.value = 100
      simInfo.value = 'Simulación completada'
      simActive.value = false
      return
    }
  }

  simAnimFrame = requestAnimationFrame(animateStep)
}

function findNearestPoint(coord: [number, number]): number {
  let minDist = Infinity
  let nearest = -1
  for (let i = 0; i < simPoints.length; i++) {
    const dx = simPoints[i].lat - coord[0]
    const dy = simPoints[i].lng - coord[1]
    const d = dx * dx + dy * dy
    if (d < minDist) { minDist = d; nearest = i }
  }
  return nearest
}

function updateSimInfo() {
  const pt = simPoints[simPointIndex]
  if (!pt) return
  const dateStr = pt.fechaHora || pt.fecha || ''
  simInfo.value = `📍 ${simPointIndex + 1}/${simPoints.length} — ${dateStr}`
}

function toggleSimPause() {
  simPaused.value = !simPaused.value
}

function setSimSpeed(speed: number) {
  simSpeed.value = speed
}

function stopSimulation() {
  simActive.value = false
  simPaused.value = false
  simProgress.value = 0
  simInfo.value = ''
  if (simAnimFrame) cancelAnimationFrame(simAnimFrame)
  if (simMarker && map) map.removeLayer(simMarker)
  if (simTrail && map) map.removeLayer(simTrail)
  simMarker = null
  simTrail = null
  simPoints = []
  simRouteCoords = []
  simCoordIndex = 0
  simPointIndex = 0
}

onMounted(() => { initMap(); syncLayers() })
onUnmounted(() => {
  stopSimulation()
  geoLayers.forEach(g => map?.removeLayer(g))
  routeLayers.forEach(pls => pls.forEach(pl => map?.removeLayer(pl)))
  map?.remove()
  map = null
})

watch(
  () => props.layers.map(l => `${l.id}:${l.visible}`).join(','),
  () => syncLayers(),
)

defineExpose({ drawRoute, clearRoute, startSimulation, stopSimulation })
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map" />

    <div v-if="props.loadingRoute" class="route-loading">
      Calculando ruta...
    </div>

    <!-- Simulation HUD -->
    <div v-if="simActive" class="sim-hud">
      <div class="sim-header">
        <span class="sim-title">Simulación de recorrido</span>
        <button type="button" class="sim-close" @click="stopSimulation()">✕</button>
      </div>
      <div class="sim-info">{{ simInfo }}</div>
      <div class="sim-bar-track">
        <div class="sim-bar-fill" :style="{ width: simProgress + '%' }" />
      </div>
      <div class="sim-controls">
        <button type="button" class="sim-btn" @click="toggleSimPause()">
          {{ simPaused ? '▶' : '⏸' }}
        </button>
        <div class="sim-speeds">
          <button
            v-for="s in [1, 2, 5, 10]"
            :key="s"
            type="button"
            class="sim-speed-btn"
            :class="{ active: simSpeed === s }"
            @click="setSimSpeed(s)"
          >
            {{ s }}x
          </button>
        </div>
        <button type="button" class="sim-btn sim-stop" @click="stopSimulation()">⏹ Detener</button>
      </div>
    </div>

    <div class="basemap-widget">
      <button
        v-for="opt in BASE_MAP_OPTIONS"
        :key="opt.id"
        type="button"
        class="basemap-btn"
        :class="{ active: activeBaseMap === opt.id }"
        :title="opt.name"
        @click="setBaseMap(opt.id)"
      >
        <span class="basemap-icon">{{ opt.icon }}</span>
        <span class="basemap-name">{{ opt.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
}
.map {
  width: 100%;
  height: 100%;
  background: #e2e8f0;
}
.route-loading {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(124, 58, 237, 0.9);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  z-index: 1000;
}

/* Simulation HUD */
.sim-hud {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  min-width: 340px;
  max-width: 480px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  color: #f1f5f9;
}
.sim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}
.sim-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sim-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.sim-close:hover { color: #f87171; background: rgba(248,113,113,0.15); }
.sim-info {
  font-size: 0.85rem;
  color: #e2e8f0;
  margin-bottom: 0.5rem;
}
.sim-bar-track {
  height: 4px;
  background: #334155;
  border-radius: 2px;
  margin-bottom: 0.6rem;
  overflow: hidden;
}
.sim-bar-fill {
  height: 100%;
  background: #7c3aed;
  border-radius: 2px;
  transition: width 0.15s;
}
.sim-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sim-btn {
  background: rgba(124, 58, 237, 0.25);
  border: 1px solid rgba(124, 58, 237, 0.4);
  color: #c4b5fd;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.sim-btn:hover { background: rgba(124, 58, 237, 0.4); color: #fff; }
.sim-stop { color: #fca5a5; border-color: rgba(252,165,165,0.3); background: rgba(252,165,165,0.1); }
.sim-stop:hover { background: rgba(252,165,165,0.25); color: #fff; }
.sim-speeds {
  display: flex;
  gap: 2px;
  flex: 1;
  justify-content: center;
}
.sim-speed-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  color: #94a3b8;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  transition: all 0.15s;
}
.sim-speed-btn:hover { background: rgba(255,255,255,0.15); color: #e2e8f0; }
.sim-speed-btn.active {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}

/* User icon */
:deep(.sim-user-icon) {
  background: none !important;
  border: none !important;
}
:deep(.sim-pin) {
  width: 28px;
  height: 28px;
  background: #7c3aed;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4px rgba(124,58,237,0.3), 0 2px 8px rgba(0,0,0,0.3);
  animation: sim-pulse 1.5s ease-in-out infinite;
}
@keyframes sim-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(124,58,237,0.3), 0 2px 8px rgba(0,0,0,0.3); }
  50% { box-shadow: 0 0 0 8px rgba(124,58,237,0.15), 0 2px 8px rgba(0,0,0,0.3); }
}

/* Basemap widget */
.basemap-widget {
  position: absolute;
  top: 10px;
  right: 10px;
  margin-top: 80px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  padding: 4px;
}
.basemap-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 0.8rem;
  border: 2px solid transparent;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.basemap-btn:hover { background: #e2e8f0; }
.basemap-btn.active {
  background: #ede9fe;
  border-color: #7c3aed;
  color: #7c3aed;
  font-weight: 600;
}
.basemap-icon { font-size: 1rem; }
.basemap-name { font-size: 0.8rem; }
:deep(.custom-tooltip) {
  background: rgba(15, 23, 42, 0.95) !important;
  border: 1px solid rgba(124, 58, 237, 0.4) !important;
  border-radius: 8px !important;
  padding: 0.5rem 0.75rem !important;
  font-size: 0.85rem !important;
  color: #f1f5f9 !important;
  max-width: 320px;
  line-height: 1.4;
}
</style>
