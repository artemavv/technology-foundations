import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import adminApi from './server/adminApi.js'

export default defineConfig(({ mode }) => {
  // ADMIN_LOGIN / ADMIN_PASSWORD (no VITE_ prefix, so never sent to the browser)
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      adminApi({ login: env.ADMIN_LOGIN, password: env.ADMIN_PASSWORD }),
    ],
  }
})
