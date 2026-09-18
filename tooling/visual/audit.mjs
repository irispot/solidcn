import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { getExampleCatalog } from './example-catalog.mjs';
import { transformExample, TRANSFORM_VERSION } from './docs/transform.mjs';

const cache = new Map();
const hash = (code) => createHash('sha256').update(code).digest('hex');
export async function auditExamples(options) {
  const entries = await getExampleCatalog(options);
  const examples = [];
  for (const entry of entries) {
    let result;
    try {
      if (entry.discoveryError) throw new Error(entry.discoveryError);
      const source = await readFile(entry.source, 'utf8');
      const sha256 = hash(source);
      const key = `${entry.source}:${sha256}:${TRANSFORM_VERSION}`;
      result = cache.get(key);
      if (!result) {
        const ast = ts.createSourceFile(
          entry.source,
          source,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        const imports = ast.statements
          .filter(ts.isImportDeclaration)
          .map((node) => node.moduleSpecifier.text);
        try {
          const transformed = transformExample(source, entry.source);
          result = {
            status: 'ready-for-browser',
            sha256,
            imports,
            transform: transformed.metadata,
          };
        } catch (error) {
          result = { status: 'needs-transform', sha256, imports, error: error.message };
        }
        cache.set(key, result);
      }
    } catch (error) {
      result = { status: 'needs-source', error: error.message };
    }
    examples.push({
      name: entry.name,
      component: entry.component,
      source: entry.sourceRelative,
      unlisted: !!entry.unlisted,
      ...result,
    });
  }
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    transformVersion: TRANSFORM_VERSION,
    total: examples.length,
    counts: Object.fromEntries(
      ['ready-for-browser', 'needs-transform', 'needs-source'].map((status) => [
        status,
        examples.filter((entry) => entry.status === status).length,
      ]),
    ),
    note: 'Static conversion check only. Ready for browser does not mean runtime, behavior, or pixel parity passed.',
    examples,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await auditExamples();
  const directory = resolve(import.meta.dirname, '../../artifacts');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'example-audit.json'), JSON.stringify(report, null, 2) + '\n');
  const errors = {};
  for (const example of report.examples.filter((entry) => entry.error)) {
    const category = example.error.replace(/^.*?:\d+:\d+: /, '');
    errors[category] = (errors[category] ?? 0) + 1;
  }
  console.log(
    JSON.stringify(
      {
        total: report.total,
        counts: report.counts,
        errors,
        report: resolve(directory, 'example-audit.json'),
      },
      null,
      2,
    ),
  );
}
