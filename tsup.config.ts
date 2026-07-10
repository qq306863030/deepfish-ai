import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server/server.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  external: ['iconv-lite'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
