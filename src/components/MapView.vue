<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import type { LayerData, GeoPoint } from '../types'
import { fetchRoute } from '../utils/routes'

const props = defineProps<{ layers: LayerData[]; loadingRoute?: string | null }>()

const mapContainer = ref<HTMLElement | null>(null)
const activeBaseMap = ref('osm')
let map: L.Map | null = null
const layerGroups = new Map<string, L.LayerGroup>()
const groupsOnMap = new Set<string>()
const routeLayers = new Map<string, L.Polyline[]>()
let baseLayer: L.TileLayer | null = null
const baseLayers: Record<string, L.TileLayer> = {}
let hasFittedInitial = false

const BASE_MAP_OPTIONS = [
  {
    id: 'osm',
    name: 'Callejero',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap',
  },
  {
    id: 'satellite',
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '© Esri',
  },
  {
    id: 'dark',
    name: 'Oscuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© CARTO',
  },
  {
    id: 'terrain',
    name: 'Terreno',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '© OpenTopoMap',
  },
]

function tooltipContent(p: GeoPoint, layerLabel: string): string {
  const lines: string[] = [
    `<strong>${layerLabel}</strong>`,
    `Coordenadas: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
  ]
  if (p.fechaHora) lines.push(`Fecha/Hora: ${p.fechaHora}`)
  if (p.fecha) lines.push(`Fecha: ${p.fecha}`)
  if (p.hora) lines.push(`Hora: ${p.hora}`)
  if (p.ubicacion) lines.push(`Ubicación: ${p.ubicacion}`)
  if (p.tipo) lines.push(`Tipo: ${p.tipo}`)
  if (p.numeroContacto) lines.push(`Contacto: ${p.numeroContacto}`)
  if (p.duracionSeg != null) lines.push(`Duración: ${p.duracionSeg} seg`)
  if (p.codigoSitio) lines.push(`Código sitio: ${p.codigoSitio}`)
  if (p.googleMaps) lines.push(`<a href="${p.googleMaps}" target="_blank" rel="noopener">Abrir en Google Maps</a>`)
  return lines.join('<br>')
}

function createMarker(p: GeoPoint, color: string, layerLabel: string): L.CircleMarker {
  const marker = L.circleMarker([p.lat, p.lng], {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
  })
  marker.bindTooltip(tooltipContent(p, layerLabel), {
    permanent: false,
    direction: 'top',
    className: 'custom-tooltip',
    offset: [0, -8],
  })
  return marker
}

function initMap() {
  if (!mapContainer.value || map) return
  map = L.map(mapContainer.value, {
    center: [21.2, -105.0],
    zoom: 9,
    zoomControl: false,
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  for (const opt of BASE_MAP_OPTIONS) {
    baseLayers[opt.id] = L.tileLayer(opt.url, { attribution: opt.attr })
  }
  baseLayer = baseLayers['osm']
  baseLayer.addTo(map)
}

function syncLayers() {
  if (!map) return
  const allPoints: [number, number][] = []
  for (const layer of props.layers) {
    let group = layerGroups.get(layer.id)
    if (!group) {
      group = L.layerGroup()
      layerGroups.set(layer.id, group)
    }
    group.clearLayers()
    if (layer.visible && layer.points.length > 0) {
      for (const p of layer.points) {
        const m = createMarker(p, layer.color, layer.label)
        group.addLayer(m)
        allPoints.push([p.lat, p.lng])
      }
    }
    if (layer.visible) {
      if (!groupsOnMap.has(layer.id)) {
        map.addLayer(group)
        groupsOnMap.add(layer.id)
      }
    } else {
      if (groupsOnMap.has(layer.id)) {
        map.removeLayer(group)
        groupsOnMap.delete(layer.id)
      }
    }
  }
  if (allPoints.length > 0 && !hasFittedInitial) {
    hasFittedInitial = true
    const bounds = L.latLngBounds(allPoints)
    if (allPoints.length === 1) {
      map.setView(allPoints[0], 12)
    } else {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }
}

async function drawRoute(layerId: string, points: GeoPoint[], color: string) {
  if (points.length < 2) return
  if (!map) throw new Error('Mapa no listo')
  const legs = await fetchRoute(points)
  if (!legs || legs.length === 0) throw new Error('No se obtuvo ruta de Google')
  const existing = routeLayers.get(layerId) || []
  for (const pl of existing) map.removeLayer(pl)
  routeLayers.set(layerId, [])
  for (const leg of legs) {
    if (leg.polyline.length < 2) continue
    const poly = L.polyline(leg.polyline, {
      color,
      weight: 5,
      opacity: 1,
    }).addTo(map)
    routeLayers.get(layerId)!.push(poly)
  }
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
  layerGroups.forEach(g => map?.removeLayer(g))
  routeLayers.forEach(pls => pls.forEach(pl => map?.removeLayer(pl)))
  map?.remove()
  map = null
})

watch(
  () => props.layers,
  (layers) => {
    syncLayers()
  },
  { deep: true }
)

defineExpose({
  drawRoute,
  clearRoute,
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map" />
    <div v-if="props.loadingRoute" class="route-loading">
      Calculando ruta...
    </div>
    <div class="map-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  flex: 1;
  position: relative;
  min-width: 0;
  margin-right: 24px;
}
.map {
  width: 100%;
  height: 100%;
  background: #0f172a;
}
.route-loading {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(26, 26, 46, 0.95);
  color: #a8dadc;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.map-controls {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  right: 1.5rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  pointer-events: none;
}
.map-controls > * {
  pointer-events: auto;
}
.basemap-selector {
  background: rgba(26, 26, 46, 0.92);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
.basemap-label {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
  margin-bottom: 0.35rem;
}
.basemap-btns {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.basemap-btn {
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  border: 1px solid rgba(168, 218, 220, 0.3);
  border-radius: 4px;
  background: transparent;
  color: #a8dadc;
  cursor: pointer;
  transition: all 0.2s;
}
.basemap-btn:hover {
  background: rgba(168, 218, 220, 0.15);
}
.basemap-btn.active {
  background: rgba(168, 218, 220, 0.25);
  border-color: #a8dadc;
}
:deep(.custom-tooltip) {
  background: rgba(26, 26, 46, 0.95) !important;
  border: 1px solid rgba(168, 218, 220, 0.4) !important;
  border-radius: 8px !important;
  padding: 0.5rem 0.75rem !important;
  font-size: 0.85rem !important;
  color: #e8e8e8 !important;
  max-width: 320px;
}
:deep(.leaflet-tooltip-left::before),
:deep(.leaflet-tooltip-right::before) {
  border-top-color: rgba(26, 26, 46, 0.95) !important;
}
</style>
