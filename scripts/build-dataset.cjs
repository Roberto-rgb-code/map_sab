/**
 * Script para limpiar y consolidar datos de sabanas y centros.
 * Ejecutar: node scripts/build-dataset.js
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const SOURCE = path.join(ROOT, '..')

// Crear carpeta data si no existe
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function parseExcelDate(serial) {
  if (serial == null || typeof serial !== 'number') return ''
  const d = new Date((serial - 25569) * 86400 * 1000)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function parseExcelTime(frac) {
  if (frac == null || typeof frac !== 'number') return ''
  const h = Math.floor(frac * 24)
  const m = Math.floor((frac * 24 - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function stripBrackets(s) {
  if (s == null) return ''
  const str = String(s).trim().replace(/^\[|\]$/g, '')
  return str
}

function parseNum(s) {
  const v = parseFloat(stripBrackets(s))
  return isNaN(v) ? null : v
}

// --- LLAMADAS desde xlsx 3222357531 y 35181280041306 ---
function extractLlamadasFromXlsx(filePath, linea) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const points = []
  // Headers en fila 11 (0-indexed)
  const headers = rows[11] || []
  const col = (name) => headers.findIndex(h => String(h || '').toUpperCase() === name.toUpperCase())
  const idxLat = col('LATITUD')
  const idxLng = col('LONGITUD')
  const idxFecha = col('FECHA')
  const idxHora = col('HORA')
  const idxTipo = col('SERV')
  const idxDir = col('T_REG') // SAL/ENT
  const idxDest = col('DEST')
  const idxDur = col('DUR')
  const idxAz = col('AZIMUTH')

  if (idxLat < 0 || idxLng < 0) return points

  for (let i = 12; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const lat = parseNum(row[idxLat])
    const lng = parseNum(row[idxLng])
    if (lat == null || lng == null || lat === 0 || lng === 0) continue
    if (lat < 15 || lat > 35 || lng < -120 || lng > -85) continue // Sanity: México

    const fecha = row[idxFecha]
    const hora = row[idxHora]
    let fechaHora = ''
    if (typeof fecha === 'number' && typeof hora === 'number') {
      const d = new Date((fecha - 25569) * 86400 * 1000)
      const h = hora * 24
      const hrs = Math.floor(h)
      const mins = Math.floor((h - hrs) * 60)
      d.setHours(hrs, mins, 0, 0)
      fechaHora = d.toISOString().slice(0, 19).replace('T', ' ')
    }

    points.push({
      lat,
      lng,
      fechaHora: fechaHora || null,
      linea: String(linea),
      tipo: row[idxTipo] ? `VOZ ${row[idxDir] || ''}`.trim() : null,
      numeroContacto: row[idxDest] ? String(row[idxDest]) : null,
      duracionSeg: row[idxDur] != null ? row[idxDur] : null,
      azimuth: row[idxAz] != null ? stripBrackets(row[idxAz]) : null,
    })
  }
  return points
}

// --- LLAMADAS desde CSV consolidado ---
function extractLlamadasFromCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8')
  const wb = XLSX.read(text, { type: 'string', raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const byLinea = new Map()
  for (const row of rows) {
    const tiene = String(row.Tiene_geoloc || row.tiene_geoloc || '').toUpperCase()
    if (tiene !== 'SI') continue
    const lat = parseFloat(row.Latitud || row.latitud)
    const lng = parseFloat(row.Longitud || row.longitud)
    if (isNaN(lat) || isNaN(lng)) continue
    const linea = String(row.Linea || row.linea || '')
    if (!linea) continue
    const pt = {
      lat,
      lng,
      fechaHora: row.FechaHora || row.fechahora || null,
      fecha: row.Fecha || row.fecha || null,
      hora: row.Hora || row.hora || null,
      linea,
      tipo: row.Tipo || row.tipo || null,
      numeroContacto: row.Numero_contacto || row.numero_contacto || null,
      duracionSeg: row.Duracion_seg ?? row.duracion_seg ?? null,
      ubicacion: row.Ubicacion || row.ubicacion || null,
      codigoSitio: row.Codigo_sitio || row.codigo_sitio || null,
      googleMaps: row.GoogleMaps || row.googlemaps || null,
    }
    if (!byLinea.has(linea)) byLinea.set(linea, [])
    byLinea.get(linea).push(pt)
  }
  return byLinea
}

// --- CENTROS ---
function extractCentros(filePath) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const points = []
  for (const row of rows) {
    // Headers: latitude col 10, longitude col 11 (segunda "latitude" en header)
    const lat = parseFloat(row.latitude)
    let lng
    if (row.longitude != null) lng = parseFloat(row.longitude)
    else if (row['latitude'] != null && typeof row['latitude'] === 'object') lng = parseFloat(Object.values(row['latitude'])[0])
    else {
      const keys = Object.keys(row)
      const latIdx = keys.findIndex(k => k.toLowerCase() === 'latitude')
      const lngKey = keys[latIdx + 1] || keys.find(k => parseFloat(row[k]) < 0)
      lng = lngKey ? parseFloat(row[lngKey]) : null
    }
    // Si no hay longitude, la segunda columna "latitude" a veces tiene el lng
    if (lng == null || isNaN(lng)) {
      const vals = Object.values(row).filter(v => typeof v === 'string' && /^-?\d+\.\d+$/.test(v))
      const nums = vals.map(Number)
      const neg = nums.find(n => n < 0)
      const pos = nums.find(n => n > 0 && n < 90)
      if (neg != null && pos != null) {
        lng = neg
        // lat ya está en pos
      }
    }
    const latVal = parseFloat(row.latitude) ?? parseFloat(row.Latitude)
    if (isNaN(latVal) || latVal < 15 || latVal > 35) continue
    const lngVal = lng
    if (lngVal == null || isNaN(lngVal) || lngVal > -85 || lngVal < -120) continue

    points.push({
      lat: latVal,
      lng: lngVal,
      nombre: row.Name || row.name || row.Nombre || null,
      direccion: row.Address || row.address || row.Direccion || null,
      telefono: row['Mobile Number'] || row.telefono || null,
      categoria: row.Catagory || row.Category || row.categoria || null,
    })
  }
  return points
}

// Centros - estructura real con columnas por índice
function extractCentrosFixed(filePath) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const points = []
  const headers = rows[0] || []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    // Col 10 = latitude (primera), Col 11 = longitude (segunda "latitude" en header es en realidad lng)
    const lat = parseFloat(row[10])
    const lng = parseFloat(row[11])
    if (isNaN(lat) || isNaN(lng)) continue
    if (lat < 15 || lat > 35 || lng > -85 || lng < -120) continue
    points.push({
      lat,
      lng,
      nombre: row[0] || null,
      direccion: row[5] || null,
      telefono: row[1] || null,
      categoria: row[4] || null,
    })
  }
  return points
}

function pointToFeature(pt) {
  const { lat, lng, ...props } = pt
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
  }
}

function toFeatureCollection(points) {
  return {
    type: 'FeatureCollection',
    features: points.map(pointToFeature),
  }
}

// --- EJECUCIÓN ---

// Si ya existe el GeoJSON y no están los archivos fuente, saltar
const outputPath = path.join(DATA_DIR, 'layers.geojson.json')
const csvExists = fs.existsSync(path.join(SOURCE, 'llamadas_con_geolocalizacion_consolidado.csv'))
const xlsx1Exists = fs.existsSync(path.join(SOURCE, '3222357531.xlsx'))
if (!csvExists && !xlsx1Exists && fs.existsSync(outputPath)) {
  console.log('Archivos fuente no encontrados. Usando GeoJSON existente.')
  process.exit(0)
}

const llamadasRaw = []

function addToLinea(linea, newPoints) {
  const existing = llamadasRaw.find(l => l.linea === linea)
  if (existing) {
    const merged = [...existing.points, ...newPoints]
    const seen = new Set()
    existing.points = merged.filter(p => {
      const key = `${p.lat},${p.lng},${p.fechaHora}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => (a.fechaHora || '').localeCompare(b.fechaHora || ''))
  } else {
    const sorted = [...newPoints].sort((a, b) => (a.fechaHora || '').localeCompare(b.fechaHora || ''))
    llamadasRaw.push({ linea, points: sorted })
  }
}

// CSV consolidado
const csvPath = path.join(SOURCE, 'llamadas_con_geolocalizacion_consolidado.csv')
if (fs.existsSync(csvPath)) {
  const byLinea = extractLlamadasFromCSV(csvPath)
  for (const [linea, points] of byLinea) {
    addToLinea(linea, points)
  }
}

// XLSX 3222357531 - CDR directo de la línea 3222357531
const xlsx1 = path.join(SOURCE, '3222357531.xlsx')
if (fs.existsSync(xlsx1)) {
  const points = extractLlamadasFromXlsx(xlsx1, '3222357531')
  console.log('3222357531.xlsx: extraídos', points.length, 'puntos con coordenadas')
  addToLinea('3222357531', points)
}

// XLSX 35181280041306 - CDR de colaboración, misma línea 3222357531
// (35181280041306 es número de referencia/IMSI, no es teléfono)
const xlsx2 = path.join(SOURCE, '35181280041306.xlsx')
if (fs.existsSync(xlsx2)) {
  const points = extractLlamadasFromXlsx(xlsx2, '3222357531')
  console.log('35181280041306.xlsx: extraídos', points.length, 'puntos con coordenadas (colaboración)')
  addToLinea('3222357531', points)
}

// Centros
let centrosPoints = []
const centrosPath = path.join(SOURCE, 'CentrosBahiaBanderas.xlsx')
if (fs.existsSync(centrosPath)) {
  centrosPoints = extractCentrosFixed(centrosPath)
}

// --- Generar GeoJSON ---
const LAYER_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#457b9d', '#e76f51']

const layers = []
let colorIdx = 0

for (const ll of llamadasRaw) {
  if (!ll.points.length) continue
  layers.push({
    id: `llamada-${ll.linea}`,
    label: ll.linea,
    color: LAYER_COLORS[colorIdx++ % LAYER_COLORS.length],
    type: 'llamadas',
    geojson: toFeatureCollection(ll.points),
  })
}

layers.push({
  id: 'centros',
  label: 'Centros Bahía Banderas',
  color: '#9b59b6',
  type: 'centros',
  geojson: toFeatureCollection(centrosPoints),
})

// Guardar un solo archivo con todas las capas en GeoJSON
fs.writeFileSync(path.join(DATA_DIR, 'layers.geojson.json'), JSON.stringify(layers), 'utf-8')

const totalPts = llamadasRaw.reduce((s, l) => s + l.points.length, 0)
console.log('GeoJSON generado en public/data/layers.geojson.json')
console.log('Llamadas:', llamadasRaw.length, 'capas,', totalPts, 'puntos')
console.log('Centros:', centrosPoints.length, 'puntos')
console.log('Total features:', totalPts + centrosPoints.length)
