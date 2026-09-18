import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const referenceApp = resolve(root, 'tooling/visual/apps/reference');
const referenceDeps = resolve(referenceApp, 'node_modules');
const registry = resolve(root, 'shadcn-ui/apps/v4/registry');
function latestSourceMtime(directory) {
  let latest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, latestSourceMtime(path));
    else if (entry.isFile()) latest = Math.max(latest, statSync(path).mtimeMs);
  }
  return latest;
}
const nativeSourceMtimes = {
  base: latestSourceMtime(resolve(root, 'base-ui/packages/solid/src')),
  shadcn: latestSourceMtime(resolve(root, 'shadcn-ui/packages/solid/src')),
};
const aliases = [
  {
    find: /^@base-ui\/react\/(.*)$/,
    replacement: resolve(root, 'base-ui/packages/react/src/$1/index.ts'),
  },
  {
    find: /^@base-ui\/react$/,
    replacement: resolve(root, 'base-ui/packages/react/src/index.ts'),
  },
  {
    find: /^@base-ui\/utils\/(store|platform)$/,
    replacement: resolve(root, 'base-ui/packages/utils/src/$1/index.ts'),
  },
  {
    find: /^@base-ui\/utils\/(.*)$/,
    replacement: resolve(root, 'base-ui/packages/utils/src/$1.ts'),
  },
  {
    find: /^@\/registry\/bases\/base\/ui\/(.*)$/,
    replacement: resolve(registry, 'bases/base/ui/$1.tsx'),
  },
  {
    find: /^@\/components\/ui\/(.*)$/,
    replacement: resolve(registry, 'bases/base/ui/$1.tsx'),
  },
  {
    find: /^@\/app\/\(create\)\/components\/icon-placeholder$/,
    replacement: resolve(referenceApp, 'icons.tsx'),
  },
  {
    find: /^@shadcn\/react\/(.*)$/,
    replacement: resolve(root, 'shadcn-ui/packages/react/src/$1/index.ts'),
  },
  {
    find: /^@shadcn\/helpers\/(.*)$/,
    replacement: resolve(root, 'shadcn-ui/packages/helpers/src/$1/index.ts'),
  },
  {
    find: /^@\/styles\/(?:base-nova\/ui(?:-rtl)?|base-rhea\/ui)\/(.*)$/,
    replacement: resolve(registry, 'bases/base/ui/$1.tsx'),
  },
  {
    find: /^@\/styles\/radix-rhea\/ui\/(.*)$/,
    replacement: resolve(registry, 'bases/radix/ui/$1.tsx'),
  },
  { find: /^cn$/, replacement: resolve(root, 'tooling/visual/apps/cn.ts') },
  { find: /^@\/lib\/utils$/, replacement: resolve(root, 'tooling/visual/apps/cn.ts') },
  {
    find: /^sonner$/,
    replacement: resolve(referenceDeps, 'sonner/dist/index.mjs'),
  },
  {
    find: /^@\/(.*)$/,
    replacement: resolve(root, 'shadcn-ui/apps/v4/$1'),
  },
  ...[
    'react-hook-form',
    'radix-ui',
    'lucide-react',
    '@tabler/icons-react',
    'cmdk',
    'embla-carousel-autoplay',
    'embla-carousel-react',
    'input-otp',
    'next-themes',
    'next',
    'react-day-picker',
    'react-resizable-panels',
    'react-textarea-autosize',
    'recharts',
    'zod',
    '@tanstack/react-table',
    'class-variance-authority',
  ].map((name) => ({
    find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=/|$)`),
    replacement: resolve(referenceDeps, name),
  })),
];

function builtPath(row) {
  if (row.module.startsWith('@solid-cn/base-ui')) {
    const suffix = row.module.slice('@solid-cn/base-ui'.length);
    return resolve(root, 'base-ui/packages/solid/dist/server', suffix.slice(1), 'index.js');
  }
  const name = row.module.slice('@solid-cn/ui/'.length);
  return resolve(root, 'shadcn-ui/packages/solid/dist/server', `${name}.js`);
}

function kind(value) {
  if (typeof value === 'function') return 'function';
  if (value && typeof value === 'object') {
    const marker = String(value.$$typeof ?? '');
    if (marker === 'Symbol(react.forward_ref)' || marker === 'Symbol(react.memo)') {
      return 'component';
    }
    return 'object';
  }
  return typeof value;
}

const server = await createServer({
  configFile: false,
  root: referenceApp,
  logLevel: 'silent',
  server: { middlewareMode: true },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: { alias: aliases },
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: ['@base-ui/react', '@base-ui/utils'] },
});

const rows = [];
try {
  const baseExports = JSON.parse(
    readFileSync(resolve(root, 'base-ui/packages/react/package.json'), 'utf8'),
  ).exports;
  const entries = Object.entries(baseExports)
    .filter(([subpath]) => !subpath.startsWith('./internals/'))
    .map(([subpath, source]) => ({
      module: `@solid-cn/base-ui${subpath === '.' ? '' : `/${subpath.slice(2)}`}`,
      original: resolve(root, 'base-ui/packages/react', source),
    }));
  const shadcn = new Set();
  for (const directory of ['bases/base/ui', 'new-york-v4/ui']) {
    for (const file of readdirSync(resolve(registry, directory))) {
      if (file.endsWith('.tsx')) shadcn.add(file.slice(0, -4));
    }
  }
  for (const name of [...shadcn].sort()) {
    const base = resolve(registry, 'bases/base/ui', `${name}.tsx`);
    entries.push({
      module: `@solid-cn/ui/${name}`,
      original: existsSync(base) ? base : resolve(registry, 'new-york-v4/ui', `${name}.tsx`),
    });
  }

  for (const entry of entries) {
    const built = builtPath(entry);
    const row = { module: entry.module, original: entry.original.slice(root.length + 1) };
    try {
      const original = await server.ssrLoadModule(entry.original);
      row.originalValues = Object.keys(original).sort();
      if (!existsSync(built)) throw new Error(`built module missing: ${built}`);
      row.staleBuild = statSync(built).mtimeMs <
        (entry.module.startsWith('@solid-cn/base-ui')
          ? nativeSourceMtimes.base : nativeSourceMtimes.shadcn);
      const native = await import(pathToFileURL(built).href);
      row.nativeValues = Object.keys(native).sort();
      row.missingValues = row.originalValues.filter((name) => !(name in native));
      row.kindDifferences = row.originalValues
        .filter((name) => name in native)
        .map((name) => ({ name, original: kind(original[name]), native: kind(native[name]) }))
        .filter(({ original: left, native: right }) => left !== right &&
          !(left === 'component' && right === 'function'));
      row.namespaceDifferences = row.originalValues
        .filter((name) => name in native &&
          original[name] && typeof original[name] === 'object' &&
          native[name] && typeof native[name] === 'object' &&
          kind(original[name]) === 'object' && kind(native[name]) === 'object')
        .map((name) => ({
          name,
          missing: Object.keys(original[name]).filter((member) => !(member in native[name])),
        }))
        .filter(({ missing }) => missing.length);
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
  }
} finally {
  await server.close();
}

const failures = rows.filter((row) => row.error || row.staleBuild || row.missingValues?.length ||
  row.kindDifferences?.length || row.namespaceDifferences?.length);
const report = {
  check: 'runtime-export-shape-audit',
  note: 'Server module exports only. React forwardRef and memo objects are normalized to Solid callable components. An older build fails by file time. This does not prove browser behavior, type signatures, or visual parity.',
  modules: rows.length,
  loadedModules: rows.length - rows.filter((row) => row.error).length,
  modulesWithGaps: failures.length,
  rows,
};
const output = resolve(root, 'artifacts/runtime-api-audit.json');
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  modules: report.modules,
  loadedModules: report.loadedModules,
  modulesWithGaps: report.modulesWithGaps,
  staleBuildModules: rows.filter((row) => row.staleBuild).length,
  errors: rows.filter((row) => row.error).slice(0, 15)
    .map(({ module: name, error }) => ({ module: name, error })),
  missingNames: rows.reduce((sum, row) => sum + (row.missingValues?.length ?? 0), 0),
  kindDifferences: rows.reduce((sum, row) => sum + (row.kindDifferences?.length ?? 0), 0),
  namespaceDifferences: rows.reduce((sum, row) => sum + (row.namespaceDifferences?.length ?? 0), 0),
  report: output,
}, null, 2));
if (failures.length) process.exitCode = 1;
