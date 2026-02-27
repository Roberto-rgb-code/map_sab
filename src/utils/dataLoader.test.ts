import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadDataset, getDirectionsApiKey } from './dataLoader'

describe('dataLoader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('getDirectionsApiKey returns default key when env is empty', () => {
    expect(getDirectionsApiKey()).toMatch(/^AIza/)
  })

  it('loadDataset fetches and parses GeoJSON layers', async () => {
    const mockData = [
      {
        id: 'llamada-123',
        label: '123',
        color: '#e63946',
        type: 'llamadas',
        geojson: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [-105, 21] }, properties: {} },
          ],
        },
      },
    ]
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const layers = await loadDataset()

    expect(fetch).toHaveBeenCalledWith('/data/layers.geojson.json')
    expect(layers).toHaveLength(1)
    expect(layers[0].id).toBe('llamada-123')
    expect(layers[0].geojson.features).toHaveLength(1)
    expect(layers[0].visible).toBe(false)
  })

  it('loadDataset throws when fetch fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })
    await expect(loadDataset()).rejects.toThrow('No se pudo cargar el dataset GeoJSON')
  })
})
