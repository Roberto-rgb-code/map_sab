import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRoute } from './routes'

function makeFC(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: coords.map(([lat, lng], i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties: { fechaHora: `2020-04-22 ${10 + i}:00:00` },
    })),
  }
}

describe('routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns null for less than 2 points', async () => {
    const result = await fetchRoute(makeFC([[21, -105]]))
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches route from Google API', async () => {
    const mockResponse = {
      status: 'OK',
      routes: [{
        overview_polyline: { points: 'abc123' },
        legs: [{
          steps: [{ polyline: { points: 'abc123' } }],
          distance: { text: '25 km' },
          duration: { text: '30 min' },
        }],
      }],
    }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    })

    const legs = await fetchRoute(makeFC([[21.03, -105.24], [21.2, -105.0]]))
    expect(fetch).toHaveBeenCalled()
    expect(legs).not.toBeNull()
    expect(legs!.length).toBeGreaterThan(0)
  })

  it('returns null when API returns error status', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS' }),
    })

    const result = await fetchRoute(makeFC([[21, -105], [21.1, -105.1]]))
    expect(result).toBeNull()
  })
})
