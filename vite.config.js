import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/EPROM/", // <--- CHANGE THIS to match your GitHub Repository name exactly (e.g., /EPROM/ or /IdeaBank/)
})