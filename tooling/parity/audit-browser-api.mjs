import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const registry = resolve(root, 'shadcn-ui/apps/v4/registry');
const referenceUrl = process.env.SOLID_CN_REFERENCE_URL ?? 'http://127.0.0.1:5181';
const solidUrl = process.env.SOLID_CN_PREVIEW_URL ?? 'http://127.0.0.1:5173';

const originalExports = JSON.parse(
  readFileSync(resolve(root, 'base-ui/packages/react/package.json'), 'utf8'),
).exports;
const entries = Object.entries(originalExports)
  .filter(([subpath]) => !subpath.startsWith('./internals/'))
  .map(([subpath, source]) => {
    const suffix = subpath === '.' ? '' : subpath.slice(2);
    return {
      module: `@solid-cn/base-ui${suffix ? `/${suffix}` : ''}`,
      original: resolve(root, 'base-ui/packages/react', source),
      native: resolve(root, 'base-ui/packages/solid/dist', suffix, 'index.js'),
      sourceRoot: resolve(root, 'base-ui/packages/solid/src'),
    };
  });
const shadcnNames = new Set();
for (const directory of ['bases/base/ui', 'new-york-v4/ui']) {
  for (const file of readdirSync(resolve(registry, directory))) {
    if (file.endsWith('.tsx')) shadcnNames.add(file.slice(0, -4));
  }
}
for (const name of [...shadcnNames].sort()) {
  const base = resolve(registry, 'bases/base/ui', `${name}.tsx`);
  entries.push({
    module: `@solid-cn/ui/${name}`,
    original: existsSync(base) ? base : resolve(registry, 'new-york-v4/ui', `${name}.tsx`),
    native: resolve(root, 'shadcn-ui/packages/solid/dist', `${name}.js`),
    sourceRoot: resolve(root, 'shadcn-ui/packages/solid/src'),
  });
}

function latestSourceMtime(directory) {
  let latest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, latestSourceMtime(path));
    else if (entry.isFile()) latest = Math.max(latest, statSync(path).mtimeMs);
  }
  return latest;
}
const sourceMtimes = new Map(
  [...new Set(entries.map(({ sourceRoot }) => sourceRoot))]
    .map((path) => [path, latestSourceMtime(path)]),
);
const browser = await chromium.launch();
const rows = [];
try {
  const reference = await browser.newPage();
  const solid = await browser.newPage();
  await Promise.all([
    reference.goto(referenceUrl, { waitUntil: 'domcontentloaded' }),
    solid.goto(solidUrl, { waitUntil: 'domcontentloaded' }),
  ]);
  const shape = async (page, path) => page.evaluate(async (modulePath) => {
    const module = await import(/* @vite-ignore */ modulePath);
    const kind = (value) => {
      if (typeof value === 'function') return 'function';
      if (value && typeof value === 'object') {
        const marker = String(value.$$typeof ?? '');
        if (marker === 'Symbol(react.forward_ref)' || marker === 'Symbol(react.memo)')
          return 'component';
        return 'object';
      }
      return typeof value;
    };
    return Object.fromEntries(Object.entries(module).map(([name, value]) => [name, {
      kind: kind(value),
      members: value && typeof value === 'object' && kind(value) === 'object'
        ? Object.keys(value).sort() : [],
    }]));
  }, path);

  for (const entry of entries) {
    const row = { module: entry.module };
    try {
      if (!existsSync(entry.native)) throw new Error('Built browser entry is missing.');
      row.staleBuild = statSync(entry.native).mtimeMs < sourceMtimes.get(entry.sourceRoot);
      const originalPath = `/@fs${entry.original}`;
      const nativePath = `/${relative(root, entry.native).split(sep).join('/')}`;
      const [expected, actual] = await Promise.all([
        shape(reference, originalPath),
        shape(solid, nativePath),
      ]);
      row.expected = expected;
      row.actual = actual;
      row.missingValues = Object.keys(expected).filter((name) => !(name in actual));
      row.kindDifferences = Object.keys(expected)
        .filter((name) => name in actual)
        .filter((name) => expected[name].kind !== actual[name].kind &&
          !(expected[name].kind === 'component' && actual[name].kind === 'function'))
        .map((name) => ({ name, original: expected[name].kind, native: actual[name].kind }));
      row.namespaceDifferences = Object.keys(expected)
        .filter((name) => name in actual && expected[name].kind === 'object' &&
          actual[name].kind === 'object')
        .map((name) => ({
          name,
          missing: expected[name].members.filter((member) =>
            !actual[name].members.includes(member)),
        }))
        .filter(({ missing }) => missing.length);
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
  }
} finally {
  await browser.close();
}

const failures = rows.filter((row) => row.error || row.staleBuild ||
  row.missingValues?.length || row.kindDifferences?.length || row.namespaceDifferences?.length);
const report = {
  check: 'browser-export-shape-audit',
  note: 'Compares live pinned React source with built Solid browser modules through Vite. React forwardRef and memo objects count as Solid callable components. This does not prove behavior, public type signatures, or raw archive loading.',
  modules: rows.length,
  loadedModules: rows.length - rows.filter((row) => row.error).length,
  modulesWithGaps: failures.length,
  rows,
};
const output = resolve(root, 'artifacts/browser-api-audit.json');
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
