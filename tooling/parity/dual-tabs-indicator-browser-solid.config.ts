import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import config from './dual-tabs-parts-solid.config.ts';

const file = 'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx';
const browserConfig = mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-indicator-native-solid-chromium',
    include: [file],
    setupFiles: [resolve(import.meta.dirname, 'tabs-browser-fixture-setup.ts')],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
browserConfig.test!.include = [file];
browserConfig.test!.setupFiles = [resolve(import.meta.dirname, 'tabs-browser-fixture-setup.ts')];
browserConfig.resolve!.alias = [
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'tabs-indicator-browser-fixture-entry.ts') },
  ...(browserConfig.resolve!.alias as Alias[]),
];
export default browserConfig;
