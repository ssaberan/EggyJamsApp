import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Separate Vite config for the offline runner build.
 *
 * - base: './'  → relative asset paths so the HTML works on file:// protocol
 * - inlineDynamicImports: true → produces a single JS chunk (no code-splitting)
 * - outDir: dist/offline-runner → keeps runner output separate from the main app
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist/offline-runner',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        runner: path.resolve(__dirname, 'runner.html'),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
