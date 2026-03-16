import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/pong-game/',
  build: {
    outDir: '../../dist/pong-game',
    emptyOutDir: true,
  },
})
