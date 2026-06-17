import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  root: 'src/serve/ui',
  plugins: [solid({ ssr: true })],
  build: {
    outDir: '../../../dist/serve/server',
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
