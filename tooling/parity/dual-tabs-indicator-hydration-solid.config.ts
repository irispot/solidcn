import { resolve } from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import { sourceAudit } from './source-audit.ts';

const root = resolve(import.meta.dirname, '../..');
const tooling = (name: string) => resolve(import.meta.dirname, name);
const fixtureJsx: Plugin = {
  name: 'unchanged-tabs-indicator-hydration-fixture-jsx',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.includes('/base-ui/packages/react/') || !id.endsWith('.tsx')) return;
    return transformWithOxc(code, id, {
      sourceType: 'module',
      jsx: { runtime: 'automatic', importSource: '@solid-cn/parity-fixture' },
    });
  },
};

export default defineConfig({
  root,
  plugins: [fixtureJsx, sourceAudit('solid'), solid({
    hot: false,
    include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/,
    solid: { generate: 'dom', hydratable: true },
  })],
  resolve: {
    conditions: ['browser', 'development'],
    alias: [
      { find: /^react$/, replacement: tooling('fixture-runtime.ts') },
      { find: /^@solid-cn\/parity-fixture\/jsx(?:-dev)?-runtime$/, replacement: tooling('fixture-runtime.ts') },
      { find: /^@mui\/internal-test-utils$/, replacement: tooling('select-client-mui-entry.ts') },
      { find: /^#test-utils$/, replacement: tooling('tabs-indicator-hydration-fixture-entry.ts') },
      { find: /^react-dom$/, replacement: tooling('select-client-fixture-dom.ts') },
      { find: /^@base-ui\/react\/tabs$/, replacement: tooling('tabs-route.ts') },
      { find: /^@base-ui\/react\/csp-provider$/, replacement: tooling('tabs-additional-route.ts') },
      { find: /^@base-ui\/utils\/(.*)$/, replacement: resolve(root, 'base-ui/packages/utils/src/$1.ts') },
    ],
  },
  test: {
    name: 'unchanged-tabs-indicator-native-solid-ssr-hydration',
    environment: 'jsdom',
    globals: true,
    include: ['base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx'],
    testNamePattern: 'pre-hydration rendering',
    setupFiles: [tooling('tabs-indicator-hydration-setup.ts')],
    maxWorkers: 1,
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
