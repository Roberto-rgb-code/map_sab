export interface LayerData {
  id: string
  label: string
  color: string
  type: 'llamadas' | 'centros'
  visible: boolean
  routeActive?: boolean
  geojson: GeoJSON.FeatureCollection
}
