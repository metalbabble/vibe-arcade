import { defineConfig } from 'vite'

export default defineConfig({
  base: '/brickout/',
  build: {
    outDir: '../../dist/brickout',
    emptyOutDir: true,
  },
})
