import { defineConfig } from 'vite'

export default defineConfig({
  base: '/face-invaders/',
  build: {
    outDir: '../../dist/face-invaders',
    emptyOutDir: true,
  },
})
