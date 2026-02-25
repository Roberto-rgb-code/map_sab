import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadDataset, getDirectionsApiKey } from './dataLoader'

describe('dataLoader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('getDirectionsApiKey returns default key when env is empty', () => {
    expect(getDirectionsApiKey()).toMatch(/^AIza/)
  })

  it('loadDataset fetches and parses dataset', async () => {
    const mockData = {
      llamadas: [
        { linea: '123', points: [{ lat: 21, lng: -105, fechaHora: '2020-01-01 10:00:00' }] },
      ],
      centros: [{ lat: 20.75, lng: -105.3, nombre: 'Centro A' }],
    }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const layers = await loadDataset()

    expect(fetch).toHaveBeenCalledWith('/data/dataset.json')
    expect(layers.length).toBe(2) // 1 llamada + 1 centros
    expect(layers[0].id).toBe('llamada-123')
    expect(layers[0].points).toHaveLength(1)
    expect(layers[0].visible).toBe(true)
    expect(layers[0].type).toBe('llamadas')
    expect(layers[1].id).toBe('centros')
    expect(layers[1].points).toHaveLength(1)
    expect(layers[1].points[0].ubicacion).toBe('Centro A')
  })

  it('loadDataset throws when fetch fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })

    await expect(loadDataset()).rejects.toThrow('No se pudo cargar el dataset')
  })
})
