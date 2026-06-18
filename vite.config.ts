import fs from 'fs-extra';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

async function copyMarkdownFiles(currentDir: string, distDir: string): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await copyMarkdownFiles(fullPath, distDir);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        await fs.copy(fullPath, path.join(distDir, entry.name));
      }
    }),
  );
}

function copySrcMarkdownFiles(): Plugin {
  return {
    name: 'copy-src-markdown-files',
    apply: 'build',
    async closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'src');
      const distDir = path.resolve(process.cwd(), 'dist');
      await copyMarkdownFiles(srcDir, distDir);
    },
  };
}

export default defineConfig({
  root: 'src/serve/ui',
  plugins: [solid(), copySrcMarkdownFiles()],
  build: {
    outDir: '../../../dist/serve/client',
    emptyOutDir: true,
  },
});
