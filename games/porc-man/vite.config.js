import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/porc-man/',
  build: {
    outDir: '../../dist/porc-man',
    emptyOutDir: true,
  },
})
