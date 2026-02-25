import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

vi.mock('./utils/dataLoader', () => ({
  loadDataset: vi.fn().mockResolvedValue([
    {
      id: 'llamada-123',
      label: '123',
      color: '#e63946',
      points: [{ lat: 21, lng: -105 }, { lat: 21.1, lng: -105.1 }],
      visible: true,
      type: 'llamadas',
    },
  ]),
}))

// Mock Leaflet
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
    layerGroup: vi.fn().mockReturnValue({
      addTo: vi.fn().mockReturnThis(),
      clearLayers: vi.fn(),
      addLayer: vi.fn(),
    }),
    circleMarker: vi.fn().mockReturnValue({
      bindTooltip: vi.fn(),
    }),
    polyline: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    latLngBounds: vi.fn(),
  },
}))

describe('App', () => {
  beforeEach(async () => {
    const { loadDataset } = await import('./utils/dataLoader')
    vi.mocked(loadDataset).mockResolvedValue([
      {
        id: 'llamada-123',
        label: '123',
        color: '#e63946',
        points: [{ lat: 21, lng: -105 }, { lat: 21.1, lng: -105.1 }],
        visible: true,
        type: 'llamadas',
      },
    ])
  })

  it('loads dataset on mount', async () => {
    const { loadDataset } = await import('./utils/dataLoader')
    mount(App)
    await new Promise((r) => setTimeout(r, 0))
    expect(loadDataset).toHaveBeenCalled()
  })

  it('passes layers to Sidebar', async () => {
    const wrapper = mount(App)
    await new Promise((r) => setTimeout(r, 100))
    const sidebar = wrapper.findComponent({ name: 'Sidebar' })
    expect(sidebar.props('layers')).toHaveLength(1)
    expect(sidebar.props('layers')[0].label).toBe('123')
  })
})
