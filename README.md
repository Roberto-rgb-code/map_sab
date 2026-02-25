# Mapa de Sabanas - Trazabilidad de Llamadas

Aplicación Vue 3 con mapa interactivo para visualizar georreferencias de sabanas de llamadas y centros.

## Características

- **Mapa interactivo** (Leaflet + OpenStreetMap)
- **Capas por número** de teléfono, activables desde el sidebar
- **Sidebar colapsable** para ganar espacio en el mapa
- **Centros Bahía Banderas** como capa adicional
- **Rutas optimizadas** con Google Directions API (ordenadas por fecha/hora para trazabilidad)
- **Tooltips** con información completa de cada punto

## Dataset limpio

Los datos se cargan desde `public/data/dataset.json`. Para regenerar el dataset desde los archivos fuente:

1. Coloca en la carpeta `sabanas/` (un nivel arriba del proyecto):
   - `llamadas_con_geolocalizacion_consolidado.csv`
   - `3222357531.xlsx`
   - `35181280041306.xlsx`
   - `CentrosBahiaBanderas.xlsx`

2. Ejecuta:
```bash
npm run build:data
```

Esto generará `public/data/dataset.json` con los datos limpiados y consolidados.

## Instalación

```bash
npm install
npm run dev
```

## API Key de Google Maps

La API de rutas (Directions API) requiere una clave. Por defecto está configurada en el código. Para producción, crea un archivo `.env`:

```
VITE_GOOGLE_MAPS_API_KEY=tu_api_key
```

## Uso

1. Las capas se cargan automáticamente desde el dataset
2. Clic en el botón ◀/▶ para colapsar/expandir el sidebar
3. Clic en cada capa para activar/desactivar
4. Clic en "Ruta" para trazar la ruta óptima por fecha/hora
5. Pasa el cursor sobre los puntos para ver detalles
