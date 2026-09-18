import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import { playwright } from './shadcn-browser-deps/node_modules/@vitest/browser-playwright/dist/index.js';
import clientConfig from './dual-shadcn-message-scroller-client-solid.config.ts';

const file = 'shadcn-ui/packages/react/src/message-scroller/message-scroller.perf.browser.test.tsx';
const originalTest = resolve(import.meta.dirname, '../..', file);
const nativeComponent = resolve(import.meta.dirname, '../../shadcn-ui/packages/solid/src/internal/message-scroller.tsx');
const nativeGeometry = resolve(import.meta.dirname, '../../shadcn-ui/packages/solid/src/internal/message-scroller/geometry.ts');
const tooling = (name: string) => resolve(import.meta.dirname, name);
const config = mergeConfig(clientConfig, {
  test: {
    name: 'unchanged-shadcn-message-scroller-native-solid-perf-chromium',
    include: [file],
    testNamePattern: '.*',
    testTimeout: 120_000,
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
// A performance proof must not measure the Solid development diagnostics.
config.resolve!.conditions = ['browser', 'production'];
config.plugins = [
  {
    name: 'unchanged-shadcn-message-scroller-perf-browser-fixture',
    enforce: 'pre',
    resolveId(id, importer) {
      if (importer?.split('?')[0] !== originalTest) return;
      if (id === '.') {
        console.log(`Solid message-scroller perf component route: ${nativeComponent}`);
        return tooling('shadcn-message-scroller-route.ts');
      }
      if (id === './geometry') {
        console.log(`Solid message-scroller perf geometry route: ${nativeGeometry}`);
        return nativeGeometry;
      }
    },
    async transform(code, id) {
      if (id.split('?')[0] === nativeGeometry) {
        console.log(`Solid message-scroller perf geometry loaded: ${nativeGeometry}`);
        return;
      }
      if (id.split('?')[0] !== originalTest) return;
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
  { find: /^solid-js$/, replacement: resolve(import.meta.dirname, '../../node_modules/solid-js/dist/solid.js') },
  { find: /^@solidjs\/web$/, replacement: resolve(import.meta.dirname, '../../node_modules/@solidjs/web/dist/web.js') },
  { find: /^@solidjs\/signals$/, replacement: resolve(import.meta.dirname, '../../node_modules/@solidjs/signals/dist/prod/index.js') },
  { find: /^react$/, replacement: tooling('shadcn-message-scroller-perf-react.ts') },
  { find: /^react-dom$/, replacement: tooling('shadcn-questionnaire-dom-flush.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
