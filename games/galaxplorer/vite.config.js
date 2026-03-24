import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/galaxplorer/',
  build: {
    outDir: '../../dist/galaxplorer',
    emptyOutDir: true,
  },
})
