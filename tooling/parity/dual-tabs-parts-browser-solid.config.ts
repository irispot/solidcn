import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import config from './dual-tabs-parts-solid.config.ts';

const browserConfig = mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-parts-native-solid-chromium',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
browserConfig.test!.setupFiles = [
  resolve(import.meta.dirname, 'tabs-parts-browser-env.ts'),
  resolve(import.meta.dirname, 'tabs-browser-fixture-setup.ts'),
];
browserConfig.resolve!.alias = [
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'tabs-indicator-browser-fixture-entry.ts') },
  ...(browserConfig.resolve!.alias as Alias[]),
];
export default browserConfig;
