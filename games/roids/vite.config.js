import { defineConfig } from 'vite'

export default defineConfig({
  base: '/roids/',
  build: {
    outDir: '../../dist/roids',
    emptyOutDir: true,
  },
})
