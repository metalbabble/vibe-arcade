import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/irate-avians/',
  build: {
    outDir: '../../dist/irate-avians',
    emptyOutDir: true,
  },
})
