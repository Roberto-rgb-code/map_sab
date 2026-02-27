<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import MapView from './components/MapView.vue'
import Sidebar from './components/Sidebar.vue'
import type { LayerData } from './types'
import { loadDataset } from './utils/dataLoader'

const layers = ref<LayerData[]>([])
const loading = ref(true)
const error = ref('')
const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const loadingRoute = ref<string | null>(null)

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    layers.value = await loadDataset()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function onTraceRoute(layer: LayerData) {
  const idx = layers.value.findIndex(x => x.id === layer.id)
  if (idx >= 0 && !layers.value[idx].visible) {
    const copy = layers.value.slice()
    copy[idx] = { ...copy[idx], visible: true }
    layers.value = copy
    await nextTick()
  }
  loadingRoute.value = layer.id
  error.value = ''
  try {
    await mapRef.value?.drawRoute(layer.id, layer.geojson, layer.color)
    const i = layers.value.findIndex(x => x.id === layer.id)
    if (i >= 0) {
      const copy = layers.value.slice()
      copy[i] = { ...copy[i], routeActive: true }
      layers.value = copy
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al trazar ruta.'
  } finally {
    loadingRoute.value = null
  }
}

function onClearRoute(id: string) {
  mapRef.value?.clearRoute(id)
  const idx = layers.value.findIndex(x => x.id === id)
  if (idx >= 0) {
    const copy = layers.value.slice()
    copy[idx] = { ...copy[idx], routeActive: false }
    layers.value = copy
  }
}

function onToggleLayer(id: string) {
  const idx = layers.value.findIndex(x => x.id === id)
  if (idx >= 0) {
    const copy = layers.value.slice()
    copy[idx] = { ...copy[idx], visible: !copy[idx].visible }
    layers.value = copy
  }
}

function onSimulate(layer: LayerData) {
  mapRef.value?.startSimulation(layer.geojson, layer.color)
}

onMounted(loadAll)
</script>

<template>
  <div class="app">
    <Sidebar
      :layers="layers"
      :loading="loading"
      :error="error"
      :loading-route="loadingRoute"
      @toggle="onToggleLayer"
      @refresh="loadAll"
      @trace-route="onTraceRoute"
      @clear-route="onClearRoute"
      @simulate="onSimulate"
    />
    <MapView ref="mapRef" :layers="layers" :loading-route="loadingRoute" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
