import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
  server: {
    port: 3006,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 3006,
    host: true,
    strictPort: true,
  },
  // SPA fallback so /pricing works on refresh in Vite preview / static hosts.
  appType: 'spa',
});
