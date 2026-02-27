import type { LayerData } from '../types'

const GOOGLE_MAPS_API_KEY = 'AIzaSyBNkRTHRBGK6YZqa34DmiZfEzc3bRynnd0'

interface RawLayer {
  id: string
  label: string
  color: string
  type: 'llamadas' | 'centros'
  geojson: GeoJSON.FeatureCollection
}

export async function loadDataset(): Promise<LayerData[]> {
  const res = await fetch('/data/layers.geojson.json')
  if (!res.ok) throw new Error('No se pudo cargar el dataset GeoJSON')
  const raw: RawLayer[] = await res.json()

  return raw.map(layer => ({
    ...layer,
    visible: false,
    routeActive: false,
  }))
}

export function getDirectionsApiKey(): string {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as Record<string, unknown>).env
      : undefined
  const key = env?.VITE_GOOGLE_MAPS_API_KEY
  return (typeof key === 'string' && key) || GOOGLE_MAPS_API_KEY
}
