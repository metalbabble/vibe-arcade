import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/brickout-plus/',
  build: {
    outDir: '../../dist/brickout-plus',
    emptyOutDir: true,
  },
})
