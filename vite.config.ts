// Modified from Aeri for 网搜 on 2026-09-22.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  publicDir: 'site-public',
  plugins: [react(), tailwindcss()],
})
