import { getRegisteredSkills } from '@/cli/cli-core/skills'
import path from 'path';


export function getSkills() {
    return [...getRegisteredSkills(), path.join(__dirname, './skills/view-learn-cache.md'), path.join(__dirname, './skills/generate-skill.md'), path.join(__dirname, './skills/generate-tool.md')];
}
