import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase'
          }
          if (id.includes('node_modules/konva/') || id.includes('node_modules/react-konva/')) {
            return 'vendor-konva'
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-lucide'
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  test: {
    include: ['tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
