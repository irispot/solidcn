import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const root = resolve(import.meta.dirname, '../../..');

// Keep browser tooling isolated from the root lock and all pinned test files.
export default defineConfig({
  root,
  resolve: {
    alias: [{ find: '@vitest/browser/context', replacement: 'vitest/browser' }],
  },
  test: {
    name: 'unchanged-shadcn-react-browser',
    include: ['shadcn-ui/packages/react/src/**/*.browser.test.{ts,tsx}'],
    setupFiles: [resolve(root, 'shadcn-ui/packages/react/vitest.browser.setup.ts')],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
