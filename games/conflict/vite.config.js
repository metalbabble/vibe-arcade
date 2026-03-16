import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/conflict/',
  build: {
    outDir: '../../dist/conflict',
    emptyOutDir: true,
  },
})
