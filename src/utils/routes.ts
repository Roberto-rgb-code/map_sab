import type { GeoPoint } from '../types'
import { getDirectionsApiKey } from './dataLoader'

const MAX_WAYPOINTS = 23 // Google allows 25 total (origin + waypoints + dest), we use 23 middle

export interface RouteLeg {
  start: GeoPoint
  end: GeoPoint
  polyline: [number, number][]
  distance: string
  duration: string
}

function samplePoints(points: GeoPoint[], maxPoints: number): GeoPoint[] {
  if (points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  const result: GeoPoint[] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1)
    result.push(points[idx])
  }
  return result
}

export async function fetchRoute(points: GeoPoint[]): Promise<RouteLeg[] | null> {
  const filtered = points.filter(p => p.lat != null && p.lng != null)
  if (filtered.length < 2) return null

  const apiKey = getDirectionsApiKey()
  const legs: RouteLeg[] = []

  // Sort by date/time for trazabilidad
  const sorted = [...filtered].sort((a, b) =>
    (a.fechaHora || a.fecha || '').localeCompare(b.fechaHora || b.fecha || '')
  )

  // Limit points for API (max 25 per request)
  const sampled = samplePoints(sorted, 25)

  const chunks: GeoPoint[][] = []
  for (let i = 0; i < sampled.length; i += MAX_WAYPOINTS) {
    chunks.push(sampled.slice(i, i + MAX_WAYPOINTS + 1))
  }

  for (const chunk of chunks) {
    const origin = chunk[0]
    const dest = chunk[chunk.length - 1]
    const waypoints = chunk.slice(1, -1)
    const waypointsStr = waypoints
      .map(p => `${p.lat},${p.lng}`)
      .join('|')

    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      mode: 'driving',
      key: apiKey,
    })
    if (waypointsStr) params.set('waypoints', waypointsStr)

    const useProxy = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    const baseUrl = useProxy ? '/api/google/directions' : 'https://maps.googleapis.com/maps/api/directions'
    const url = `${baseUrl}/json?${params}`
    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      throw new Error('Error de red. ¿Hay conexión a internet?')
    }
    const data = await res.json()
    const msg = data.error_message || ''
    if (data.status === 'REQUEST_DENIED') {
      throw new Error('API key inválida. Activa Directions API en Google Cloud. ' + msg)
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Límite de consultas excedido. ' + msg)
    }
    if (data.status !== 'OK' || !data.routes?.[0]) return null

    const route = data.routes[0]
    const routeLegs = route.legs || []
    const fullPolyline = decodePolyline(route.overview_polyline?.points || '')

    if (routeLegs.length === 0 && fullPolyline.length > 0) {
      legs.push({
        start: chunk[0],
        end: chunk[chunk.length - 1],
        polyline: fullPolyline,
        distance: '',
        duration: '',
      })
    } else {
      for (let i = 0; i < routeLegs.length; i++) {
        const leg = routeLegs[i]
        const steps = leg.steps || []
        const polyline: [number, number][] = []
        for (const step of steps) {
          const pts = decodePolyline(step.polyline?.points)
          polyline.push(...pts)
        }
        legs.push({
          start: { ...chunk[i], lat: leg.start_location?.lat ?? chunk[i]?.lat, lng: leg.start_location?.lng ?? chunk[i]?.lng },
          end: { ...chunk[i + 1], lat: leg.end_location?.lat ?? chunk[i + 1]?.lat, lng: leg.end_location?.lng ?? chunk[i + 1]?.lng },
          polyline: polyline.length ? polyline : fullPolyline,
          distance: leg.distance?.text || '',
          duration: leg.duration?.text || '',
        })
      }
    }
  }
  return legs
}

function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return []
  const points: [number, number][] = []
  let i = 0
  let lat = 0
  let lng = 0
  while (i < encoded.length) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}
