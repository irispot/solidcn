import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { selectedTests } from './selected-tests.mjs';
import { sourceAudit } from './source-audit.ts';

const root = resolve(import.meta.dirname, '../..');
const reactSource = resolve(root, 'base-ui/packages/react/src');
const utilsSource = resolve(root, 'base-ui/packages/utils/src');

// Keep the original test files and their helpers. Only resolve workspace package
// names to the pinned React and utility sources in this checkout.
export default defineConfig({
  root,
  plugins: [sourceAudit('react')],
  resolve: {
    alias: [
      { find: /^@base-ui\/react\/(.+)$/, replacement: `${reactSource}/$1/index.ts` },
      { find: /^@base-ui\/utils\/(.+)$/, replacement: `${utilsSource}/$1` },
      { find: /^#test-utils$/, replacement: resolve(root, 'base-ui/packages/react/test/index.ts') },
      { find: /^#formatErrorMessage$/, replacement: resolve(utilsSource, 'formatErrorMessage.ts') },
    ],
  },
  test: {
    name: 'unchanged-components-react-reference',
    environment: 'jsdom',
    globals: true,
    environmentOptions: { jsdom: { pretendToBeVisual: true, url: 'http://localhost' } },
    setupFiles: [resolve(root, 'base-ui/test/setupVitest.ts')],
    include: selectedTests,
    reporters: ['default'],
  },
});
