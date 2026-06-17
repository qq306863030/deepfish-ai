import type { Command } from 'commander';
import { handleCacheList, handleCacheEdit, handleCacheDel } from './cli-core/cache';

export function registerCacheCommands(program: Command) {
  const cache = program.command('cache');
  cache.command('ls').description('List all cache items').action(handleCacheList);
  cache.command('edit')
    .description('Edit a cache item')
    .argument('<index|id>', 'Index or id of the cache item')
    .action((input: string) => handleCacheEdit(input));
  cache.command('del')
    .description('Delete a cache item')
    .argument('<index|id>', 'Index or id of the cache item')
    .action((input: string) => handleCacheDel(input));
}
