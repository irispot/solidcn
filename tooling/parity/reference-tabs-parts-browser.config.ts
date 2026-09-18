import { resolve } from 'node:path';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import config from './reference-tabs-parts.config.ts';

const browserConfig = mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-parts-react-chromium',
    setupFiles: [resolve(import.meta.dirname, 'tabs-parts-browser-env.ts')],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
export default browserConfig;
