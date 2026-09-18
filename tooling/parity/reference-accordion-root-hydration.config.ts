import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import config from './reference-accordion-root-client.config.ts';

const merged = mergeConfig(config, {
  test: {
    name: 'unchanged-accordion-root-react-ssr-hydration',
    testNamePattern: 'preserves generated part associations during hydration',
  },
});
merged.resolve!.alias = [
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'accordion-root-hydration-react-fixture-entry.ts') },
  ...(merged.resolve!.alias as Alias[]),
];
export default merged;
