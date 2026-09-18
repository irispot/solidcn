import { mkdir, realpath, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const scope = resolve(root, 'node_modules/@base-ui');
await mkdir(scope, { recursive: true });

for (const [name, source] of [
  ['react', 'base-ui/packages/react'],
  ['utils', 'base-ui/packages/utils'],
]) {
  const link = resolve(scope, name);
  const target = resolve(root, source);
  try {
    const existing = await realpath(link);
    if (existing !== target) {
      throw new Error(`${link} resolves to ${existing}, not ${target}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await symlink(target, link, 'dir');
  }
}
