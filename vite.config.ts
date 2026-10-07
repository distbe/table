import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', import.meta.url)), 'utf8'))

export default defineConfig({
  // Relative asset paths keep the build working under any sub path.
  base: './',
  plugins: [react()],
  define: {
    VERSION: JSON.stringify(pkg.version),
  },
})
