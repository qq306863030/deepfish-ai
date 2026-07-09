import { getRegisteredSkills } from '@/cli/cli-core/skills'
import { getCodePath } from '@/cli/cli-utils/getGlobalPath';
import path from 'path';

const skillsDir = path.join(getCodePath(), 'dist', 'skills');

export function getSkills() {
    return [...getRegisteredSkills(), path.join(skillsDir, 'view-learn-cache.md'), path.join(skillsDir, 'generate-skill.md'), path.join(skillsDir, 'generate-tool.md')];
}
