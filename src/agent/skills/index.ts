import { getRegisteredSkills } from '@/cli/cli-core/skills'
import path from 'path';


export function getSkills() {
    return [...getRegisteredSkills(), path.join(__dirname, './view-learn-cache.md')];
}
