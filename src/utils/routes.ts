import { getDirectionsApiKey } from './dataLoader'

export interface RouteLeg {
  polyline: [number, number][]
  distance: string
  duration: string
}

interface SimplePoint {
  lat: number
  lng: number
  fechaHora?: string
  fecha?: string
}

const MAX_WAYPOINTS = 23

export function featuresToPoints(fc: GeoJSON.FeatureCollection): SimplePoint[] {
  return fc.features
    .filter(f => f.geometry.type === 'Point')
    .map(f => {
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
      return {
        lat,
        lng,
        fechaHora: f.properties?.fechaHora ?? undefined,
        fecha: f.properties?.fecha ?? undefined,
      }
    })
    .filter(p => isFinite(p.lat) && isFinite(p.lng))
}

function samplePoints(points: SimplePoint[], maxPoints: number): SimplePoint[] {
  if (points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  const result: SimplePoint[] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1)
    result.push(points[idx])
  }
  return result
}

export async function fetchRoute(geojson: GeoJSON.FeatureCollection): Promise<RouteLeg[] | null> {
  const points = featuresToPoints(geojson)
  if (points.length < 2) return null

  const apiKey = getDirectionsApiKey()
  const legs: RouteLeg[] = []

  const sorted = [...points].sort((a, b) =>
    (a.fechaHora || a.fecha || '').localeCompare(b.fechaHora || b.fecha || '')
  )

  const sampled = samplePoints(sorted, 25)

  const chunks: SimplePoint[][] = []
  for (let i = 0; i < sampled.length; i += MAX_WAYPOINTS) {
    chunks.push(sampled.slice(i, i + MAX_WAYPOINTS + 1))
  }

  for (const chunk of chunks) {
    const origin = chunk[0]
    const dest = chunk[chunk.length - 1]
    const waypoints = chunk.slice(1, -1)
    const waypointsStr = waypoints.map(p => `${p.lat},${p.lng}`).join('|')

    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      mode: 'driving',
      key: apiKey,
    })
    if (waypointsStr) params.set('waypoints', waypointsStr)

    const url = `/api/google/directions/json?${params}`

    let res: Response
    try {
      res = await fetch(url)
    } catch {
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
      legs.push({ polyline: fullPolyline, distance: '', duration: '' })
    } else {
      for (const leg of routeLegs) {
        const polyline: [number, number][] = []
        for (const step of leg.steps || []) {
          polyline.push(...decodePolyline(step.polyline?.points))
        }
        legs.push({
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
    lat += (result & 1) ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1

    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}
