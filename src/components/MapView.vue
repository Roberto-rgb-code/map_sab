<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import type { LayerData } from '../types'
import { fetchRoute } from '../utils/routes'

const props = defineProps<{ layers: LayerData[]; loadingRoute?: string | null }>()

const mapContainer = ref<HTMLElement | null>(null)
const activeBaseMap = ref('google')
let map: L.Map | null = null
const geoLayers = new Map<string, L.GeoJSON>()
const routeLayers = new Map<string, L.Polyline[]>()
let baseLayer: L.TileLayer | null = null
const baseLayers: Record<string, L.TileLayer> = {}

const canvasRenderer = L.canvas({ padding: 0.5 })

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

  for (const [, gl] of geoLayers) {
    map.removeLayer(gl)
  }
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
    const poly = L.polyline(leg.polyline, {
      color,
      weight: 4,
      opacity: 0.9,
    }).addTo(map)
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
  for (const pl of existing) {
    if (map) map.removeLayer(pl)
  }
  routeLayers.set(layerId, [])
}

onMounted(() => {
  initMap()
  syncLayers()
})

onUnmounted(() => {
  geoLayers.forEach(g => map?.removeLayer(g))
  routeLayers.forEach(pls => pls.forEach(pl => map?.removeLayer(pl)))
  map?.remove()
  map = null
})

watch(
  () => props.layers.map(l => `${l.id}:${l.visible}`).join(','),
  () => syncLayers(),
)

defineExpose({ drawRoute, clearRoute })
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map" />
    <div v-if="props.loadingRoute" class="route-loading">
      Calculando ruta...
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
.basemap-btn:hover {
  background: #e2e8f0;
}
.basemap-btn.active {
  background: #ede9fe;
  border-color: #7c3aed;
  color: #7c3aed;
  font-weight: 600;
}
.basemap-icon {
  font-size: 1rem;
}
.basemap-name {
  font-size: 0.8rem;
}
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
