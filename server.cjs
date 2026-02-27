const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/api/google/directions/json', async (req, res) => {
  const url = `https://maps.googleapis.com/maps/api/directions/json?${req.url.split('?')[1] || ''}`
  try {
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(502).json({ status: 'ERROR', error_message: err.message })
  }
})

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
