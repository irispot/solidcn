import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
const originalPackage = JSON.parse(readFileSync(resolve(root, 'base-ui/packages/react/package.json'), 'utf8'));
const entries = [];

for (const [subpath, source] of Object.entries(originalPackage.exports)) {
  if (subpath.startsWith('./internals/')) continue;
  const suffix = subpath === '.' ? '' : subpath.slice(2);
  entries.push({
    module: `@solid-cn/base-ui${suffix ? `/${suffix}` : ''}`,
    original: resolve(root, 'base-ui/packages/react', source),
    native: resolve(root, 'base-ui/packages/solid/src', suffix, 'index.ts'),
  });
}

const registry = resolve(root, 'shadcn-ui/apps/v4/registry');
const styled = new Set();
for (const directory of ['bases/base/ui', 'new-york-v4/ui']) {
  for (const file of readdirSync(resolve(registry, directory))) {
    if (file.endsWith('.tsx')) styled.add(file.slice(0, -4));
  }
}
for (const name of [...styled].sort()) {
  const base = resolve(registry, 'bases/base/ui', `${name}.tsx`);
  const fallback = resolve(registry, 'new-york-v4/ui', `${name}.tsx`);
  entries.push({
    module: `@solid-cn/ui/${name}`,
    original: existsSync(base) ? base : fallback,
    native: resolve(root, 'shadcn-ui/packages/solid/src', `${name}.tsx`),
  });
}

const sources = entries.flatMap(({ original, native }) => [original, native]);
const program = ts.createProgram(sources, {
  noEmit: true,
  allowJs: false,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();
const exportCache = new Map();

function exportsOf(path) {
  if (exportCache.has(path)) return exportCache.get(path);
  const source = program.getSourceFile(path);
  if (!source) return { error: 'source file missing', values: [], types: [] };
  const values = new Set();
  const types = new Set();
  // Save the partial result before recursion. Barrels can refer to each other.
  const result = { values: [], types: [] };
  exportCache.set(path, result);
  const add = (name, value, type) => {
    if (value) values.add(name);
    if (type) types.add(name);
  };
  const moduleSource = (specifier) => {
    if (!specifier) return undefined;
    const symbol = checker.getSymbolAtLocation(specifier);
    const target = symbol?.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
    return target?.declarations?.find(ts.isSourceFile)?.fileName;
  };
  const classify = (node) => {
    const symbol = checker.getSymbolAtLocation(node);
    const target = symbol?.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
    return {
      value: !!(target?.flags & ts.SymbolFlags.Value),
      type: !!(target?.flags & ts.SymbolFlags.Type),
    };
  };
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node)) {
      const targetPath = moduleSource(node.moduleSpecifier);
      const target = targetPath ? exportsOf(targetPath) : undefined;
      if (!node.exportClause) {
        for (const name of target?.values ?? [])
          add(name, !node.isTypeOnly, node.isTypeOnly);
        for (const name of target?.types ?? []) add(name, false, true);
      } else if (ts.isNamespaceExport(node.exportClause)) {
        add(node.exportClause.name.text, !node.isTypeOnly, node.isTypeOnly);
      } else {
        for (const item of node.exportClause.elements) {
          const name = item.name.text;
          const local = item.propertyName?.text ?? name;
          const typeOnly = node.isTypeOnly || item.isTypeOnly;
          const known = target &&
            (target.values.includes(local) || target.types.includes(local));
          const fallback = known ? undefined : classify(item.propertyName ?? item.name);
          add(name,
            !typeOnly && (known ? target.values.includes(local) : fallback?.value),
            typeOnly || (known ? target.types.includes(local) : fallback?.type));
        }
      }
      continue;
    }
    const isExported = !!node.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;
    const isDefault = !!node.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.DefaultKeyword);
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) add(declaration.name.text, true, false);
    } else if (ts.isFunctionDeclaration(node)) {
      add(isDefault ? 'default' : node.name?.text, true, false);
    } else if (ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
      add(isDefault ? 'default' : node.name?.text, true, true);
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      add(node.name.text, false, true);
    } else if (ts.isModuleDeclaration(node)) {
      add(node.name.text, true, false);
    } else if (ts.isExportAssignment(node)) {
      add('default', true, false);
    }
  }
  result.values = [...values].filter(Boolean).sort();
  result.types = [...types].filter(Boolean).sort();
  return result;
}

const rows = entries.map(({ module: moduleName, original, native }) => {
  const expected = exportsOf(original);
  const actual = exportsOf(native);
  return {
    module: moduleName,
    original: original.slice(root.length + 1),
    native: native.slice(root.length + 1),
    expectedCounts: { values: expected.values.length, types: expected.types.length },
    actualCounts: { values: actual.values.length, types: actual.types.length },
    missingValues: expected.values.filter((name) => !actual.values.includes(name)),
    missingTypes: expected.types.filter((name) => !actual.types.includes(name)),
    errors: [expected.error, actual.error].filter(Boolean),
  };
});
const failing = rows.filter((row) =>
  row.errors.length || row.missingValues.length || row.missingTypes.length);
const report = {
  check: 'source-export-name-audit',
  note: 'Static source-name audit only. It does not prove runtime values, types, behavior, or release parity.',
  modules: rows.length,
  modulesWithGaps: failing.length,
  missingValueNames: rows.reduce((sum, row) => sum + row.missingValues.length, 0),
  missingTypeNames: rows.reduce((sum, row) => sum + row.missingTypes.length, 0),
  distinctMissingValueNames: new Set(rows.flatMap((row) => row.missingValues)).size,
  distinctMissingTypeNames: new Set(rows.flatMap((row) => row.missingTypes)).size,
  gaps: failing,
};
const output = resolve(root, 'artifacts/api-surface-audit.json');
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  ...report,
  gaps: failing.map((row) => ({
    module: row.module,
    missingValues: row.missingValues.length,
    missingTypes: row.missingTypes.length,
    errors: row.errors,
  })),
  report: output,
}, null, 2));
if (failing.length) process.exitCode = 1;
