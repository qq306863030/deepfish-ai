import fs from 'fs-extra';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

function copySrcMarkdownFiles(): Plugin {
  return {
    name: 'copy-src-markdown-files',
    apply: 'build',
    async closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'src');
      const distDir = path.resolve(process.cwd(), 'dist');
      const skillsDir = path.join(srcDir, 'server/agent/skills');
      const targetSkillsDir = path.join(distDir, 'skills');

      // 复制 agent/skills 到 dist/skills
      if (await fs.pathExists(skillsDir)) {
        const files = await fs.readdir(skillsDir);
        await fs.ensureDir(targetSkillsDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            await fs.copy(path.join(skillsDir, file), path.join(targetSkillsDir, file));
          }
        }
      }
    },
  };
}

export default defineConfig({
  root: 'src/server/ui',
  plugins: [solid(), copySrcMarkdownFiles()],
  build: {
    outDir: '../../../dist/server/web-ui',
    emptyOutDir: true,
  },
});
