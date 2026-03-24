import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/tankzone3d/',
  build: {
    outDir: '../../dist/tankzone3d',
    emptyOutDir: true,
  },
})
