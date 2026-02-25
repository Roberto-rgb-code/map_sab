import type { GeoPoint, LayerData } from '../types'

const GOOGLE_MAPS_API_KEY = 'AIzaSyBNkRTHRBGK6YZqa34DmiZfEzc3bRynnd0'

const LAYER_COLORS = [
  '#e63946',
  '#2a9d8f',
  '#e9c46a',
  '#264653',
  '#457b9d',
  '#e76f51',
]

export async function loadDataset(): Promise<LayerData[]> {
  const res = await fetch('/data/dataset.json')
  if (!res.ok) throw new Error('No se pudo cargar el dataset')
  const data = (await res.json()) as {
    llamadas: Array<{ linea: string; points: GeoPoint[] }>
    centros: Array<{
      lat: number
      lng: number
      nombre?: string
      direccion?: string
      telefono?: string
      categoria?: string
    }>
  }

  const layers: LayerData[] = []
  let colorIdx = 0

  for (const ll of data.llamadas) {
    if (!ll.points?.length) continue
    const points = ll.points.map((p) => ({
      ...p,
      lat: Number(p.lat),
      lng: Number(p.lng),
    }))
    const sorted = [...points].sort((a, b) =>
      (a.fechaHora || '').localeCompare(b.fechaHora || '')
    )
    layers.push({
      id: `llamada-${ll.linea}`,
      label: ll.linea,
      color: LAYER_COLORS[colorIdx++ % LAYER_COLORS.length],
      points: sorted,
      visible: true,
      type: 'llamadas',
    })
  }

  const centrosPoints: GeoPoint[] = data.centros.map((c) => ({
    lat: Number(c.lat),
    lng: Number(c.lng),
    ubicacion: c.nombre || c.direccion || undefined,
    numeroContacto: c.telefono || undefined,
    tipo: c.categoria || undefined,
  }))

  layers.push({
    id: 'centros',
    label: 'Centros Bahía Banderas',
    color: '#9b59b6',
    points: centrosPoints,
    visible: true,
    type: 'centros',
  })

  return layers
}

export function getDirectionsApiKey(): string {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as Record<string, unknown>).env
      : undefined
  const key = env?.VITE_GOOGLE_MAPS_API_KEY
  return (typeof key === 'string' && key) || GOOGLE_MAPS_API_KEY
}
