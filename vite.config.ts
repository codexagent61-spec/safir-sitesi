/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages, projeyi https://<kullanici>.github.io/safir-sitesi/ altinda yayinlar;
// bu nedenle production build'inde base yolu repo adiyla ayni olmalidir.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === 'production' ? '/safir-sitesi/' : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
