<script setup lang="ts">
import type { LayerData } from '../types'

defineProps<{
  layers: LayerData[]
  loading: boolean
  error: string
  loadingRoute: string | null
  onToggle: (id: string) => void
  onRefresh: () => void
  onTraceRoute: (layer: LayerData) => void
  onClearRoute: (id: string) => void
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">M</span>
        <span class="logo-text">Mapa Sabanas</span>
      </div>
      <p class="subtitle">Trazabilidad de llamadas</p>
    </div>
    <div v-if="error" class="error-msg">{{ error }}</div>
    <div class="capas-section">
      <div class="capas-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
        </svg>
        <span>Capas GIS</span>
      </div>
      <button type="button" class="btn-refresh" :disabled="loading" @click="onRefresh()">
        {{ loading ? 'Cargando...' : 'Actualizar datos' }}
      </button>
    </div>
    <nav class="layer-list">
      <div v-for="layer in layers" :key="layer.id" class="layer-row">
        <button
          type="button"
          class="layer-item"
          :class="{ active: layer.visible }"
          @click="onToggle(layer.id)"
        >
          <span class="layer-icon">
            <span class="layer-dot" :style="{ backgroundColor: layer.color }" />
          </span>
          <span class="layer-label">{{ layer.label }}</span>
          <span class="layer-count">{{ layer.points.length }}</span>
        </button>
        <div
          v-if="layer.type === 'llamadas' && layer.points.length >= 2"
          class="layer-actions"
        >
          <button
            type="button"
            class="btn-route"
            :disabled="!!loadingRoute"
            :title="loadingRoute === layer.id ? 'Calculando...' : 'Trazar ruta'"
            @click.stop="onTraceRoute(layer)"
          >
            {{ loadingRoute === layer.id ? '...' : 'Ruta' }}
          </button>
          <button
            type="button"
            class="btn-clear-route"
            title="Quitar ruta"
            @click.stop="onClearRoute(layer.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </nav>
    <div class="sidebar-footer">
      <p>Activa capas y usa Ruta para trazar.</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 300px;
  flex-shrink: 0;
  background: #f8fafc;
  color: #334155;
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 12px rgba(0,0,0,0.08);
  z-index: 1000;
  border-radius: 0 12px 0 0;
}
.sidebar-header {
  padding: 1.5rem 1.25rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.logo-icon {
  width: 40px;
  height: 40px;
  background: #7c3aed;
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
}
.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}
.subtitle {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #64748b;
  padding-left: 52px;
}
.error-msg {
  margin: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #dc2626;
}
.capas-section {
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}
.capas-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.75rem;
}
.capas-title svg {
  color: #7c3aed;
}
.btn-refresh {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #7c3aed;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-refresh:hover:not(:disabled) {
  background: #f5f3ff;
  border-color: #c4b5fd;
}
.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0.5rem;
}
.layer-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #334155;
  font: inherit;
}
.layer-item:hover {
  background: #f1f5f9;
}
.layer-item.active {
  background: #f5f3ff;
  color: #7c3aed;
}
.layer-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.layer-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.layer-label {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
  color: inherit;
}
.layer-item.active .layer-label {
  color: #7c3aed;
}
.layer-count {
  font-size: 0.8rem;
  color: #94a3b8;
}
.layer-item.active .layer-count {
  color: #a78bfa;
}
.layer-actions {
  display: flex;
  gap: 0.25rem;
  padding: 0 1rem 0.5rem 2.75rem;
}
.btn-route,
.btn-clear-route {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-route {
  background: #7c3aed;
  color: #fff;
}
.btn-route:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-route:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-clear-route {
  background: #f1f5f9;
  color: #64748b;
}
.btn-clear-route:hover {
  background: #fee2e2;
  color: #dc2626;
}
.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #94a3b8;
}
</style>
