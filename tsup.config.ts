import { defineConfig } from 'tsup';
import pkg from './package.json';

// 需要保持外部化的包（原生模块 / 进程管理器，无法纯 JS 打包）
const EXTERNAL_DEPS = ['sharp', 'pm2'];

// 其余 dependencies 全部打包进 dist（tree-shaking 自动剔除未使用代码）
const NO_EXTERNAL = Object.keys(pkg.dependencies || {})
  .filter((dep) => !EXTERNAL_DEPS.includes(dep));

export default defineConfig({
  entry: ['src/index.ts', 'src/serve/pm2-server.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  noExternal: NO_EXTERNAL,
  external: EXTERNAL_DEPS,
  platform: 'node',
  target: 'node18',
  treeshake: true,
  minify: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
