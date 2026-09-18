import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
export const fingerprint = (files) =>
  createHash('sha256').update(JSON.stringify(files)).digest('hex');
export async function sourceProvenance() {
  const paths = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.vite', '.git'].includes(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const path of [
    'tooling/visual',
    'base-ui/packages/solid/src',
    'shadcn-ui/packages/solid/src',
  ])
    await walk(resolve(root, path));
  for (const path of [
    'package-lock.json',
    'tooling/generate-icons.mjs',
    'tooling/parity/upstreams.json',
    'base-ui/packages/solid/package.json',
    'shadcn-ui/packages/solid/package.json',
  ])
    paths.push(resolve(root, path));
  const files = {};
  for (const path of paths.sort())
    files[relative(root, path)] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  // Commit plus exact working-tree diff covers all original files, including
  // documentation, examples, registries, styles, and their transitive helpers.
  // The new native package is untracked and is hashed separately above.
  for (const repository of ['base-ui', 'shadcn-ui']) {
    const git = (...args) =>
      execFileSync('git', ['-C', resolve(root, repository), ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      });
    const inputs = {
      head: git('rev-parse', 'HEAD'),
      trackedDiff: git('diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD', '--'),
      untracked: git('ls-files', '--others', '--exclude-standard')
        .split('\n')
        .filter((path) => path && !path.startsWith('packages/solid/'))
        .sort()
        .join('\n'),
    };
    for (const [name, value] of Object.entries(inputs))
      files[`@git/${repository}/${name}`] = createHash('sha256').update(value).digest('hex');
  }
  return files;
}
