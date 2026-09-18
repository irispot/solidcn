import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './dual-radio-group-client-solid.config.ts';

const config = mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-radio-group-native-solid-chromium',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
config.test!.setupFiles = [resolve(import.meta.dirname, 'switch-browser-fixture-setup.ts')];
config.resolve!.alias = [
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'switch-browser-fixture-entry.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
