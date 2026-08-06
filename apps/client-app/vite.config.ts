import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    host: true,
    strictPort: true,
  },
  define: {
    global: 'window',
    __DEV__: JSON.stringify(true),
    'process.env': JSON.stringify({ NODE_ENV: 'development' }),
  },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      'react-native': path.resolve(__dirname, 'src/web/shims/react-native.ts'),
      '@react-native-community/geolocation': path.resolve(
        __dirname,
        'src/web/shims/geolocation.ts',
      ),
      'react-native-screens': path.resolve(__dirname, 'src/web/shims/react-native-screens.ts'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
      ],
      loader: {
        '.js': 'jsx',
      },
    },
    include: [
      'react-native-web',
      '@react-native-async-storage/async-storage',
      'react-native-safe-area-context',
      'react-native-gesture-handler',
      'leaflet',
    ],
  },
});
