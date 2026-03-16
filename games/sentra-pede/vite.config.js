import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/sentra-pede/',
  build: {
    outDir: '../../dist/sentra-pede',
    emptyOutDir: true,
  },
})
