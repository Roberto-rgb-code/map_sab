import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import type { LayerData } from '../types'

const mockLayers: LayerData[] = [
  {
    id: 'llamada-3310885855',
    label: '3310885855',
    color: '#e63946',
    points: [
      { lat: 21.03, lng: -105.24 },
      { lat: 21.2, lng: -105.0 },
    ],
    visible: true,
    type: 'llamadas',
  },
  {
    id: 'centros',
    label: 'Centros Bahía Banderas',
    color: '#9b59b6',
    points: [{ lat: 20.75, lng: -105.3 }],
    visible: false,
    type: 'centros',
  },
]

const props = {
  layers: mockLayers,
  loading: false,
  error: '',
  loadingRoute: null,
  onToggle: vi.fn(),
  onRefresh: vi.fn(),
  onTraceRoute: vi.fn(),
  onClearRoute: vi.fn(),
}

describe('Sidebar', () => {
  it('renders layers', () => {
    const wrapper = mount(Sidebar, { props })
    expect(wrapper.text()).toContain('3310885855')
    expect(wrapper.text()).toContain('Centros Bahía Banderas')
    expect(wrapper.text()).toContain('Capas GIS')
  })

  it('calls onToggle when layer is clicked', async () => {
    const wrapper = mount(Sidebar, { props })
    await wrapper.find('.layer-item').trigger('click')
    expect(props.onToggle).toHaveBeenCalledWith('llamada-3310885855')
  })

  it('calls onTraceRoute when Ruta button is clicked', async () => {
    const wrapper = mount(Sidebar, { props })
    await wrapper.find('.btn-route').trigger('click')
    expect(props.onTraceRoute).toHaveBeenCalledWith(mockLayers[0])
  })

  it('shows Ruta button only for llamadas with 2+ points', () => {
    const wrapper = mount(Sidebar, { props })
    const routeBtns = wrapper.findAll('.btn-route')
    expect(routeBtns.length).toBe(1)
  })

  it('calls onRefresh when refresh button is clicked', async () => {
    const wrapper = mount(Sidebar, { props })
    await wrapper.find('.btn-refresh').trigger('click')
    expect(props.onRefresh).toHaveBeenCalled()
  })
})
