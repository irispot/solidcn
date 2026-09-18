import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '..');
function exportsOf(code, filename) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const names = [];
  const namespaces = [];
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause) {
      if (ts.isNamespaceExport(node.exportClause)) {
        names.push(node.exportClause.name.text);
        namespaces.push(node.exportClause.name.text);
      } else
        for (const item of node.exportClause.elements)
          if (!item.isTypeOnly) names.push(item.name.text);
    }
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        names.push(node.name.text);
      if (ts.isVariableStatement(node))
        for (const declaration of node.declarationList.declarations)
          if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
    }
  }
  return { names, namespaces };
}
const manifest = JSON.parse(
  await readFile(resolve(root, 'base-ui/packages/react/package.json'), 'utf8'),
);
const base = [];
for (const [entry, sourcePath] of Object.entries(manifest.exports)) {
  if (entry === '.' || entry === './types' || entry.startsWith('./internals/')) continue;
  const name = entry.slice(2);
  const code = await readFile(resolve(root, 'base-ui/packages/react', sourcePath), 'utf8');
  const expected = exportsOf(code, sourcePath);
  const output = resolve(root, 'base-ui/packages/solid/dist/server', name, 'index.js');
  if (!existsSync(output)) {
    base.push({ name, missing: expected.names, moduleMissing: true });
    continue;
  }
  const current = await import(pathToFileURL(output).href);
  const missing = expected.names.filter((name) => !(name in current));
  const parts = resolve(root, 'base-ui/packages/react/src', name, 'index.parts.ts');
  if (existsSync(parts)) {
    const expectedParts = exportsOf(await readFile(parts, 'utf8'), parts).names;
    for (const namespace of expected.namespaces)
      for (const part of expectedParts)
        if (!(part in (current[namespace] ?? {}))) missing.push(`${namespace}.${part}`);
  }
  base.push({ name, missing, exported: Object.keys(current) });
}
const directories = ['bases/base/ui', 'new-york-v4/ui'];
const shadcn = new Map();
for (const dir of directories)
  for (const name of await readdir(resolve(root, 'shadcn-ui/apps/v4/registry', dir))) {
    if (!name.endsWith('.tsx') || shadcn.has(name)) continue;
    const sourcePath = resolve(root, 'shadcn-ui/apps/v4/registry', dir, name);
    const expected = exportsOf(await readFile(sourcePath, 'utf8'), sourcePath).names;
    const output = resolve(
      root,
      'shadcn-ui/packages/solid/dist/server',
      name.replace('.tsx', '.js'),
    );
    if (!existsSync(output)) {
      shadcn.set(name, { name, missing: expected, moduleMissing: true });
      continue;
    }
    const current = await import(pathToFileURL(output).href);
    shadcn.set(name, {
      name,
      missing: expected.filter((name) => !(name in current)),
      exported: Object.keys(current).length,
    });
  }
const report = {
  note: 'Export coverage only. Presence does not prove behavioral equivalence.',
  solidVersion: '2.0.0-rc.8',
  base,
  shadcn: [...shadcn.values()],
};
const missing = [...base, ...shadcn.values()].filter(
  (item) => item.moduleMissing || item.missing.length,
);
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await writeFile(resolve(root, 'artifacts/export-inventory.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ baseModules: base.length, shadcnModules: shadcn.size, missing }, null, 2),
);
if (missing.length) process.exitCode = 1;
