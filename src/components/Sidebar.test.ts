import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import type { LayerData } from '../types'

function makeGeoJSON(count: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [-105 + i * 0.01, 21 + i * 0.01] },
      properties: {},
    })),
  }
}

const mockLayers: LayerData[] = [
  {
    id: 'llamada-3310885855',
    label: '3310885855',
    color: '#e63946',
    geojson: makeGeoJSON(3),
    visible: true,
    type: 'llamadas',
  },
  {
    id: 'centros',
    label: 'Centros Bahía Banderas',
    color: '#9b59b6',
    geojson: makeGeoJSON(1),
    visible: false,
    type: 'centros',
  },
]

describe('Sidebar', () => {
  it('renders layers', () => {
    const wrapper = mount(Sidebar, {
      props: { layers: mockLayers, loading: false, error: '', loadingRoute: null },
    })
    expect(wrapper.text()).toContain('3310885855')
    expect(wrapper.text()).toContain('Centros Bahía Banderas')
    expect(wrapper.text()).toContain('Capas GIS')
  })

  it('emits toggle when layer is clicked', async () => {
    const wrapper = mount(Sidebar, {
      props: { layers: mockLayers, loading: false, error: '', loadingRoute: null },
    })
    await wrapper.find('.layer-btn').trigger('click')
    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')![0]).toEqual(['llamada-3310885855'])
  })

  it('shows Ruta button only for llamadas with 2+ features', () => {
    const wrapper = mount(Sidebar, {
      props: { layers: mockLayers, loading: false, error: '', loadingRoute: null },
    })
    const routeBtns = wrapper.findAll('.btn-route')
    expect(routeBtns.length).toBe(1)
  })

  it('emits refresh when refresh button is clicked', async () => {
    const wrapper = mount(Sidebar, {
      props: { layers: mockLayers, loading: false, error: '', loadingRoute: null },
    })
    await wrapper.find('.btn-refresh').trigger('click')
    expect(wrapper.emitted('refresh')).toBeTruthy()
  })
})
