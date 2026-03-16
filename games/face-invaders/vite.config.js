import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/face-invaders/',
  build: {
    outDir: '../../dist/face-invaders',
    emptyOutDir: true,
  },
})
