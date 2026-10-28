import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adminApi from './server/adminApi.js'
import accountsApi from './server/accountsApi.js'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      // first: it tells adminApi who is signed in, and adminApi answers 404 to every /api/ path it doesn't know
      accountsApi(),
      adminApi(),
    ],
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          translations: 'translations.html',
          proposals: 'proposals.html',
          login: 'login.html',
          memory: 'memory.html',
          myChronos: 'my-chronos.html',
          profile: 'profile.html',
          players: 'players.html',
          train: 'train.html',
          users: 'users.html',
          chronos: 'chronos.html',
        },
      },
    },
  }
})
