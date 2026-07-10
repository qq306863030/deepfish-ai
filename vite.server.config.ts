import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  root: 'src/server/ui',
  plugins: [solid({ ssr: true })],
  build: {
    outDir: '../../../dist/server/server',
    emptyOutDir: true,
    ssr: 'entry-server.tsx',
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  ssr: {
    external: ['solid-js'],
    target: 'node',
  },
});
