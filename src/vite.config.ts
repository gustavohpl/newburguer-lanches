import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 5173,
    host: true, // Permite acesso via IP local (para testar no celular)
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // Permitir importação de variáveis de ambiente com prefixo VITE_
  envPrefix: 'VITE_',
})