<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LayerData } from '../types'

defineProps<{
  layers: LayerData[]
  loading: boolean
  error: string
  loadingRoute: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'refresh'): void
  (e: 'trace-route', layer: LayerData): void
  (e: 'clear-route', id: string): void
  (e: 'simulate', layer: LayerData): void
}>()

const NOTES_KEY = 'sabanas-map-notes'
const notes = ref<Record<string, string>>({})
const editingNote = ref<string | null>(null)

onMounted(() => {
  try {
    const saved = localStorage.getItem(NOTES_KEY)
    if (saved) notes.value = JSON.parse(saved)
  } catch { /* ignore */ }
})

function saveNote(layerId: string, text: string) {
  notes.value[layerId] = text
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes.value))
}

function toggleEdit(layerId: string) {
  editingNote.value = editingNote.value === layerId ? null : layerId
}
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
      <button type="button" class="btn-refresh" :disabled="loading" @click="emit('refresh')">
        {{ loading ? 'Cargando...' : 'Actualizar datos' }}
      </button>
    </div>
    <nav class="layer-list">
      <div v-for="layer in layers" :key="layer.id" class="layer-card" :class="{ active: layer.visible }">
        <button
          type="button"
          class="layer-btn"
          @click="emit('toggle', layer.id)"
        >
          <span class="toggle-track" :class="{ on: layer.visible }">
            <span class="toggle-thumb" />
          </span>
          <span class="layer-dot" :style="{ backgroundColor: layer.color }" />
          <span class="layer-name">{{ layer.label }}</span>
        </button>
        <div class="note-area">
          <div v-if="editingNote === layer.id" class="note-edit">
            <textarea
              class="note-input"
              :value="notes[layer.id] || ''"
              placeholder="Escribe una nota..."
              rows="2"
              @input="saveNote(layer.id, ($event.target as HTMLTextAreaElement).value)"
              @click.stop
              @keydown.stop
            />
            <button type="button" class="note-done" @click.stop="toggleEdit(layer.id)">Listo</button>
          </div>
          <button
            v-else
            type="button"
            class="note-toggle"
            @click.stop="toggleEdit(layer.id)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {{ notes[layer.id] ? notes[layer.id] : 'Agregar nota' }}
          </button>
        </div>
        <button
          v-if="layer.type === 'llamadas' && (layer.geojson?.features?.length ?? 0) >= 2"
          type="button"
          class="btn-route"
          :class="{ active: layer.routeActive }"
          :disabled="!!loadingRoute"
          @click.stop="layer.routeActive ? emit('clear-route', layer.id) : emit('trace-route', layer)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 17l4-4 4 4 4-4 4 4"/>
          </svg>
          {{ loadingRoute === layer.id ? 'Trazando...' : layer.routeActive ? 'Quitar ruta' : 'Trazar ruta' }}
        </button>
        <button
          v-if="layer.type === 'llamadas' && layer.routeActive"
          type="button"
          class="btn-simulate"
          @click.stop="emit('simulate', layer)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/>
          </svg>
          Simular recorrido
        </button>
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
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.layer-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.15s;
}
.layer-card:hover {
  border-color: #c4b5fd;
  box-shadow: 0 2px 6px rgba(124, 58, 237, 0.08);
}
.layer-card.active {
  border-color: #7c3aed;
  background: #faf5ff;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.12);
}
.layer-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.7rem 0.75rem;
  cursor: pointer;
  background: transparent;
  border: none;
  font: inherit;
  color: #334155;
  gap: 0.5rem;
}
.toggle-track {
  display: flex;
  align-items: center;
  width: 32px;
  min-width: 32px;
  height: 18px;
  border-radius: 9px;
  background: #cbd5e1;
  padding: 2px;
  transition: background 0.2s;
}
.toggle-track.on {
  background: #7c3aed;
}
.toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.toggle-track.on .toggle-thumb {
  transform: translateX(14px);
}
.layer-dot {
  width: 10px;
  min-width: 10px;
  height: 10px;
  border-radius: 50%;
}
.layer-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-card.active .layer-name {
  color: #7c3aed;
}
.note-area {
  padding: 0 0.75rem 0.4rem;
}
.note-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.72rem;
  cursor: pointer;
  padding: 0.15rem 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: inherit;
  transition: color 0.15s;
}
.note-toggle:hover {
  color: #7c3aed;
}
.note-toggle svg {
  flex-shrink: 0;
}
.note-edit {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.note-input {
  width: 100%;
  padding: 0.4rem 0.5rem;
  font-size: 0.78rem;
  font-family: inherit;
  border: 1px solid #c4b5fd;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.note-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
}
.note-done {
  align-self: flex-end;
  background: none;
  border: none;
  color: #7c3aed;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  border-radius: 4px;
}
.note-done:hover {
  background: #f5f3ff;
}
.btn-route {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0.75rem 0.6rem 0.75rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #7c3aed;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-route svg {
  color: #7c3aed;
}
.btn-route:hover:not(:disabled) {
  background: #f5f3ff;
  border-color: #c4b5fd;
}
.btn-route.active {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}
.btn-route.active svg {
  color: #fff;
}
.btn-route.active:hover:not(:disabled) {
  background: #6d28d9;
}
.btn-route:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-simulate {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0.75rem 0.6rem 0.75rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid #059669;
  border-radius: 6px;
  background: #059669;
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-simulate svg {
  color: #fff;
}
.btn-simulate:hover {
  background: #047857;
}
.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #94a3b8;
}
</style>
