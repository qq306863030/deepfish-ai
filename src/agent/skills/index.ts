import { getRegisteredSkills } from '@/cli/cli-core/skills'
import { getCodePath } from '@/cli/cli-utils/getGlobalPath'
import path from 'path';
import fs from 'fs';

export function getSkills() {
  const codePath = getCodePath();
  const skillsDir = path.join(codePath, 'dist', 'skills');
  const builtinFiles = ['view-learn-cache.md', 'generate-skill.md', 'generate-tool.md'];
  const builtinSkills = builtinFiles
    .map((f) => path.join(skillsDir, f))
    .filter((f) => fs.existsSync(f));

  return [...getRegisteredSkills(), ...builtinSkills];
}
