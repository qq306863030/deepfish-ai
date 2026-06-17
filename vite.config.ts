import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  root: 'src/serve/ui',
  plugins: [solid()],
  build: {
    outDir: '../../../dist/serve/client',
    emptyOutDir: true,
  },
});
