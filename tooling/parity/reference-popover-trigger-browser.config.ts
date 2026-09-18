import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './reference-popover-trigger-client.config.ts';

export default mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-popover-trigger-react-chromium',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
