import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

function sourcePaths(directory) {
  const paths = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...sourcePaths(path));
    else if (/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) paths.push(path);
  }
  return paths;
}

export function parityInputHashes() {
  const paths = [
    'package.json',
    'package-lock.json',
    'base-ui/packages/react/package.json',
    'base-ui/packages/solid/package.json',
    'shadcn-ui/packages/react/package.json',
    'shadcn-ui/packages/solid/package.json',
    ...sourcePaths('base-ui/packages/react/src'),
    ...sourcePaths('base-ui/packages/react/test'),
    ...sourcePaths('base-ui/packages/utils/src'),
    ...sourcePaths('base-ui/packages/solid/src'),
    ...sourcePaths('shadcn-ui/packages/react/src'),
    ...sourcePaths('shadcn-ui/packages/solid/src'),
    ...sourcePaths('tooling/parity'),
    'base-ui/test/setupVitest.ts',
  ];
  const files = Object.fromEntries(paths.sort().map((path) => [
    path,
    createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'),
  ]));
  return {
    digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    files,
  };
}
