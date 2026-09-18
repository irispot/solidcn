import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import { readIconDefinitions } from './visual/docs/icons.mjs';

const root = resolve(import.meta.dirname, '..');
const dependencies = resolve(root, 'tooling/visual/apps/reference/node_modules');
const registry = resolve(root, 'shadcn-ui/apps/v4/registry/bases/base/ui');
const names = new Set();
for (const name of await readdir(registry)) {
  if (!name.endsWith('.tsx')) continue;
  const code = await readFile(resolve(registry, name), 'utf8');
  for (const match of code.matchAll(/\blucide="([^"]+)"/g)) names.add(match[1]);
}
const definitions = await readIconDefinitions('lucide', [...names], dependencies);
if (definitions.some((icon) => icon.version !== '0.474.0'))
  throw new Error('Review the icon package version before updating native data.');
const icons = Object.fromEntries(
  definitions.map(({ name, iconName, nodes }) => [name, { iconName, nodes }]),
);
const sourceHashes = {};
for (const definition of definitions)
  sourceHashes[definition.name] = createHash('sha256')
    .update(await readFile(definition.source))
    .digest('hex');
const code = await format(
  `// Generated from lucide-react@0.474.0 SVG data. No React runtime is used.
// Source hashes: ${JSON.stringify(sourceHashes)}
// License: ../LUCIDE-LICENSE. Check with node tooling/generate-icons.mjs --check.
export const registryIcons: Record<string, { iconName: string; nodes: [string, Record<string, string | number>][] }> = ${JSON.stringify(icons)};
`,
  { parser: 'typescript', singleQuote: true, printWidth: 100, trailingComma: 'all' },
);
const target = resolve(root, 'shadcn-ui/packages/solid/src/icon-data.ts');
if (process.argv.includes('--print')) process.stdout.write(code);
else if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== code)
    throw new Error('Native SVG data differs from the pinned icon source.');
  console.log(
    JSON.stringify({
      passed: true,
      icons: definitions.length,
      version: '0.474.0',
      source: 'literal upstream SVG nodes',
      runtimeReact: false,
    }),
  );
} else
  throw new Error(
    'Use --print to inspect generated source, or --check to verify existing source. This command never overwrites native files.',
  );
