import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './dual-shadcn-questionnaire-client-solid.config.ts';

const file = 'shadcn-ui/packages/react/src/questionnaire/questionnaire.browser.test.tsx';
const config = mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-shadcn-questionnaire-native-solid-chromium',
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
config.test!.include = [file];
const testFile = resolve(import.meta.dirname, '../../shadcn-ui/packages/react/src/questionnaire/questionnaire.browser.test.tsx');
// The client route's transform and relative import match must target the
// unchanged browser file. Keep the browser path out of the native package.
config.plugins = [
  {
    name: 'unchanged-shadcn-questionnaire-browser-fixture',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === '.' && importer?.split('?')[0] === testFile) {
        console.log(`Solid questionnaire browser route: ${resolve(import.meta.dirname, '../../shadcn-ui/packages/solid/src/internal/questionnaire.tsx')}`);
        return resolve(import.meta.dirname, 'shadcn-questionnaire-route.ts');
      }
    },
    async transform(code, id) {
      if (id.split('?')[0] !== testFile) return;
      const { transformWithOxc } = await import('vite');
      return transformWithOxc(code, id, {
        sourceType: 'module',
        jsx: { runtime: 'automatic', importSource: '@solid-cn/parity-fixture' },
      });
    },
  },
  ...(config.plugins ?? []),
];
config.resolve!.alias = [
  { find: /^@vitest\/browser\/context$/, replacement: 'vitest/browser' },
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'shadcn-questionnaire-dom-flush.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
