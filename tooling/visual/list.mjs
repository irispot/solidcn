import { getExampleCases, discoverDocumentation } from './example-catalog.mjs';
import { cases } from './fixtures.mjs';

if (process.argv.includes('--docs')) {
  for (const page of await discoverDocumentation())
    console.log(`${page.page}: ${page.examples.length} examples — ${page.docUrl}`);
} else {
  for (const fixture of [...cases, ...(await getExampleCases())])
    console.log(`${fixture.id}${fixture.sourceExample ? ` — ${fixture.sourceExample}` : ''}`);
}
