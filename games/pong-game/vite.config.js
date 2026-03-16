import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pong-game/',
  build: {
    outDir: '../../dist/pong-game',
    emptyOutDir: true,
  },
})
