export interface GeoPoint {
  lat: number
  lng: number
  fechaHora?: string
  fecha?: string
  hora?: string
  linea?: string
  tipo?: string
  direccion?: string
  numeroContacto?: string
  duracionSeg?: number | string
  ubicacion?: string
  latitudDMS?: string
  longitudDMS?: string
  azimuth?: string | number
  codigoSitio?: string
  googleMaps?: string
  raw?: Record<string, unknown>
}

export interface LayerData {
  id: string
  label: string
  color: string
  points: GeoPoint[]
  visible: boolean
  type: 'llamadas' | 'centros'
}
