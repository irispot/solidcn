import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './reference-accordion-root-client.config.ts';

export default mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-accordion-root-react-chromium-diagnostic',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
