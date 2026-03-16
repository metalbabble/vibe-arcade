import { defineConfig } from 'vite'

export default defineConfig({
  base: '/conflict/',
  build: {
    outDir: '../../dist/conflict',
    emptyOutDir: true,
  },
})
