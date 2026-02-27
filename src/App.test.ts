import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

vi.mock('./utils/dataLoader', () => ({
  loadDataset: vi.fn().mockResolvedValue([
    {
      id: 'llamada-123',
      label: '123',
      color: '#e63946',
      type: 'llamadas',
      visible: false,
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-105, 21] }, properties: {} },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-105.1, 21.1] }, properties: {} },
        ],
      },
    },
  ]),
}))

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn().mockReturnValue({
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      remove: vi.fn(),
      setView: vi.fn(),
      fitBounds: vi.fn(),
    }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    control: { zoom: vi.fn().mockReturnValue({ addTo: vi.fn() }) },
    geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    canvas: vi.fn().mockReturnValue({}),
    latLngBounds: vi.fn(),
    divIcon: vi.fn().mockReturnValue({}),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setLatLng: vi.fn(), remove: vi.fn() }),
    polyline: vi.fn().mockReturnValue({ addTo: vi.fn(), addLatLng: vi.fn(), remove: vi.fn() }),
  },
}))

describe('App', () => {
  it('loads dataset on mount', async () => {
    const { loadDataset } = await import('./utils/dataLoader')
    mount(App)
    await new Promise((r) => setTimeout(r, 0))
    expect(loadDataset).toHaveBeenCalled()
  })
})
