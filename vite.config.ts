// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 한전 API 프록시
      '/api-kepco': {
        target: 'https://bigdata.kepco.co.kr',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-kepco/, ''),
      },
      // 브이월드 API 프록시
      '/vworld.kr': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/vworld.kr/, ''),
      },
    },
  },
});