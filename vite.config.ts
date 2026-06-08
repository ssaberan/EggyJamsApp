import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so Electron loadFile (file://) resolves assets in production.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  worker: {
    // The magic-webp worker is an ES module that loads its WASM via dynamic
    // import; the default IIFE worker format can't code-split.
    format: 'es',
  },
})
