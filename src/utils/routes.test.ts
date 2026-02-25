import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRoute } from './routes'
import type { GeoPoint } from '../types'

describe('routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns null for less than 2 points', async () => {
    const result = await fetchRoute([{ lat: 21, lng: -105 }])
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches route from Google API', async () => {
    const points: GeoPoint[] = [
      { lat: 21.0325, lng: -105.246, fechaHora: '2020-04-22 10:00:00' },
      { lat: 21.2, lng: -105.0, fechaHora: '2020-04-22 11:00:00' },
    ]
    const mockResponse = {
      status: 'OK',
      routes: [{
        overview_polyline: { points: 'abc123' },
        legs: [
          {
            start_location: { lat: 21.0325, lng: -105.246 },
            end_location: { lat: 21.2, lng: -105.0 },
            steps: [{ polyline: { points: 'abc123' } }],
            distance: { text: '25 km' },
            duration: { text: '30 min' },
          },
        ],
      }],
    }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    })

    const legs = await fetchRoute(points)

    expect(fetch).toHaveBeenCalled()
    expect(legs).not.toBeNull()
    expect(legs!.length).toBeGreaterThan(0)
    expect(legs![0].polyline).toBeDefined()
  })

  it('returns null when API returns error', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS' }),
    })

    const result = await fetchRoute([
      { lat: 21, lng: -105 },
      { lat: 21.1, lng: -105.1 },
    ])
    expect(result).toBeNull()
  })
})
