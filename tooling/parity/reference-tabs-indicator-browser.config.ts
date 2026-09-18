import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import config from './reference-tabs-client.config.ts';

const file = 'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx';
const browserConfig = mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-indicator-react-chromium',
    include: [file],
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
export default browserConfig;
