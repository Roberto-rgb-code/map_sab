import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/google/directions': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google\/directions/, '/maps/api/directions'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
