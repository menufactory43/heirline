import { defineConfig } from 'vite'

// Le client est servi par le serveur de jeu en production (dist/) ; en dev, Vite renvoie l'API et les salles vers lui.
const SERVEUR = `http://127.0.0.1:${process.env.PORT ?? 2700}`
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    proxy: {
      '/api': SERVEUR, '/mcp': SERVEUR,
      '/matchmake': SERVEUR,
      '^/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$': { target: SERVEUR, ws: true },
    },
  },
})
