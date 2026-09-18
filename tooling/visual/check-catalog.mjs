import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  getExampleCatalog,
  getExampleCases,
  discoverDocumentation,
  extractPreviewMetadata,
} from './example-catalog.mjs';
import { cases as fixtures } from './fixtures.mjs';

// This diagnostic reads the frozen upstream files. It does not edit test files.
const directory = resolve(import.meta.dirname, '../../shadcn-ui/apps/v4/examples/base');
const files = (await readdir(directory))
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => `docs/${name.slice(0, -4)}`);
const sources = await getExampleCatalog({ pages: '*' });
const cases = await getExampleCases({ pages: '*' });
const documentation = await discoverDocumentation();
const names = sources.map((entry) => entry.name);
assert.equal(new Set(names).size, names.length, 'One catalog entry per source');
for (const file of files) assert.ok(names.includes(file), `Source omitted: ${file}`);
for (const name of documentation.flatMap((page) => page.examples))
  assert.ok(names.includes(`docs/${name}`), `Documentation example omitted: ${name}`);
for (const name of names)
  assert.ok(
    cases.some((entry) => entry.exampleName === name),
    `No preview case: ${name}`,
  );
assert.equal(
  new Set([...fixtures, ...cases].map((entry) => entry.id)).size,
  fixtures.length + cases.length,
  'Unique case IDs',
);
const chart = sources.find((entry) => entry.name === 'docs/chart-demo').preview;
assert.ok(
  chart.className.includes('[&_.preview>div]:w-full'),
  'Quoted > must not truncate className',
);
assert.ok(
  chart.layout.rules.some((rule) => rule.target === 'children' && rule.style.width === '100%'),
);
assert.ok(
  chart.layout.rules.some((rule) => rule.target === 'preview' && rule.style.padding === '0px'),
);
const ai = sources.find((entry) => entry.name === 'docs/ai-sdk-helper-demo').preview;
assert.ok(ai.source.endsWith('helpers/ai-sdk.mdx'));
assert.ok(ai.previewClassName.includes('h-auto'));
assert.ok(
  ai.layout.rules.some((rule) => rule.minWidth === 640 && rule.style['padding-top'] === '64px'),
);
const dynamic = extractPreviewMetadata(
  '<ComponentPreview name="probe" previewClassName={computed} {...props} align="start" />',
  'probe.mdx',
)[0];
assert.deepEqual(dynamic.unsupportedAttributes, ['previewClassName', 'spread']);
assert.ok(dynamic.layout.rules.some((rule) => rule.style['align-items'] === 'flex-start'));
const units = extractPreviewMetadata(
  '<ComponentPreview name="units" previewClassName="sm:h-[24.5rem] items-start" />',
  'units.mdx',
)[0];
assert.equal(units.layout.unsupportedLayoutClasses.length, 0);
assert.ok(
  units.layout.rules.some(
    (rule) => rule.minWidth === 640 && rule.style['--source-preview-min-height'] === '24.5rem',
  ),
);
console.log(
  JSON.stringify(
    {
      passed: true,
      upstreamFiles: files.length,
      sourceEntries: sources.length,
      notLinkedInDocumentation: sources.filter((entry) => entry.unlisted).length,
      exampleCases: cases.length,
      sharedChecks: fixtures.length,
      totalCases: cases.length + fixtures.length,
      allFilesVisible: true,
      sourcePreviewLayouts: sources.filter((entry) => entry.preview).length,
      previewLayoutsWithUnsupportedAttributes: sources.filter(
        (entry) => entry.preview?.unsupportedAttributes.length,
      ).length,
      previewLayoutsWithUnsupportedClasses: sources.filter(
        (entry) => entry.preview?.layout.unsupportedLayoutClasses.length,
      ).length,
    },
    null,
    2,
  ),
);
