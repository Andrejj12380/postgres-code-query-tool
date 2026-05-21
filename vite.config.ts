import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: ((): Record<string, any> => {
          const apiPort = env.SERVER_PORT || '3005';
          return { '/api': `http://localhost:${apiPort}` };
        })()
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
