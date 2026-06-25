import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync('/tmp/localhost.key'),
      cert: fs.readFileSync('/tmp/localhost.crt'),
    },
  },
})