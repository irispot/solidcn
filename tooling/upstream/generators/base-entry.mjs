import ts from 'typescript';
import { format } from 'prettier';
import { readFile } from 'node:fs/promises';

/** Parse only public export declarations. This does not translate implementations. */
export function exportSurface(input) {
  const source = ts.createSourceFile(
    input.path,
    input.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (source.parseDiagnostics.length) throw new Error('Invalid Base UI export source.');
  const runtime = [];
  const types = [];
  const stars = [];
  for (const node of source.statements) {
    if (
      !ts.isExportDeclaration(node) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      node.attributes
    )
      throw new Error(`Base entry source is not a plain export barrel: ${input.path}`);
    const module = node.moduleSpecifier.text;
    if (!module.startsWith('.')) throw new Error(`Unexpected external export: ${module}`);
    if (!node.exportClause) {
      (node.isTypeOnly ? types : stars).push({ module, kind: 'star' });
    } else if (ts.isNamespaceExport(node.exportClause)) {
      (node.isTypeOnly ? types : runtime).push({
        module,
        kind: 'namespace',
        name: node.exportClause.name.text,
      });
    } else {
      for (const item of node.exportClause.elements) {
        if (
          !ts.isIdentifier(item.name) ||
          (item.propertyName && !ts.isIdentifier(item.propertyName))
        )
          throw new Error('String-named exports require review.');
        (node.isTypeOnly || item.isTypeOnly ? types : runtime).push({
          module,
          kind: 'named',
          local: item.propertyName?.text ?? item.name.text,
          name: item.name.text,
        });
      }
    }
  }
  return { runtime, types, stars };
}

export async function generate({ inputs, options }) {
  if (inputs.length !== 1) throw new Error('Base leaf entry requires one source input.');
  const surface = exportSurface(inputs[0]);
  if (JSON.stringify(surface.types) !== JSON.stringify(options.expectedTypeSurface))
    throw new Error(
      'Upstream type export surface changed. Review the explicit native type policy.',
    );
  let code;
  if (options.passthrough) {
    if (surface.runtime.length || surface.types.length || !surface.stars.length)
      throw new Error('Unsupported passthrough export surface.');
    code = surface.stars
      .map((entry) => `export * from ${JSON.stringify(entry.module)};`)
      .join('\n');
  } else {
    if (
      surface.stars.length ||
      !surface.runtime.length ||
      !/^\.\.\/[a-z-]+$/.test(options.nativeModule)
    )
      throw new Error('Unsupported native export group or wildcard.');
    const names = surface.runtime.map((entry) => entry.name);
    for (const source of options.liftTypeModules ?? []) {
      if (!surface.types.some((entry) => entry.module === source && entry.kind === 'star'))
        throw new Error(`Missing source for extra helper export: ${source}`);
      names.push(source.split('/').at(-1));
    }
    if (new Set(names).size !== names.length) throw new Error('Duplicate runtime export.');
    code = `export { ${names.join(', ')} } from ${JSON.stringify(options.nativeModule)};\n`;
    if (options.nativeTypes === 'group-star') {
      if (!surface.types.length) throw new Error('A grouped type export requires upstream types.');
      code += `export type * from ${JSON.stringify(options.nativeModule)};\n`;
    } else if (Array.isArray(options.nativeTypes)) {
      const derived = new Set(
        surface.types.flatMap((entry) =>
          entry.kind === 'named'
            ? [entry.name]
            : entry.kind === 'star' && /\/[^/]+Root$/.test(entry.module)
              ? [`${entry.module.split('/').at(-1)}Props`]
              : [],
        ),
      );
      const exported = options.nativeTypes.map((entry) => {
        if (!derived.has(entry.public))
          throw new Error(`Missing upstream type for native mapping: ${entry.public}`);
        return entry.native && entry.native !== entry.public
          ? `${entry.native} as ${entry.public}`
          : entry.public;
      });
      if (exported.length)
        code += `export type { ${exported.join(', ')} } from ${JSON.stringify(options.nativeModule)};\n`;
    } else if (options.nativeTypes !== 'omit')
      throw new Error('An explicit native type policy is required.');
  }
  const formatOptions = JSON.parse(
    await readFile(new URL('./format.json', import.meta.url), 'utf8'),
  );
  return format(code, { ...formatOptions, parser: 'typescript' });
}
