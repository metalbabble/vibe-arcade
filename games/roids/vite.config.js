import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/roids/',
  build: {
    outDir: '../../dist/roids',
    emptyOutDir: true,
  },
})
