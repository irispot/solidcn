import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './dual-shadcn-message-scroller-client-solid.config.ts';

const file = 'shadcn-ui/packages/react/src/message-scroller/message-scroller.browser.test.tsx';
const testFile = resolve(import.meta.dirname, '../../', file);
const tooling = (name: string) => resolve(import.meta.dirname, name);
const config = mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-shadcn-message-scroller-native-solid-chromium',
    include: [file],
    testNamePattern: '.*',
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
config.plugins = [
  {
    name: 'unchanged-shadcn-message-scroller-browser-fixture',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === '.' && importer?.split('?')[0] === testFile) {
        console.log(`Solid message-scroller browser route: ${resolve(import.meta.dirname, '../../shadcn-ui/packages/solid/src/internal/message-scroller.tsx')}`);
        return tooling('shadcn-message-scroller-route.ts');
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
  { find: /^react$/, replacement: tooling('shadcn-message-scroller-browser-react.ts') },
  { find: /^react-dom$/, replacement: tooling('shadcn-questionnaire-dom-flush.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
