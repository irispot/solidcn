import { resolve } from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

const root = resolve(import.meta.dirname, '../..');
const tooling = (file: string) => resolve(import.meta.dirname, file);
const fixtureJsx: Plugin = {
  name: 'unchanged-upstream-fixture-jsx',
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
  plugins: [
    fixtureJsx,
    solid({ hot: false, include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/ }),
  ],
  resolve: {
    conditions: ['browser', 'development'],
    alias: [
      { find: /^react$/, replacement: tooling('fixture-runtime.ts') },
      {
        find: /^@solid-cn\/parity-fixture\/jsx(?:-dev)?-runtime$/,
        replacement: tooling('fixture-runtime.ts'),
      },
      { find: /^@mui\/internal-test-utils$/, replacement: tooling('fixture-renderer.ts') },
      { find: /^#test-utils$/, replacement: tooling('fixture-entry.ts') },
      { find: /^@base-ui\/react\/separator$/, replacement: tooling('separator-route.ts') },
    ],
  },
  test: {
    name: 'unchanged-separator-native-solid',
    environment: 'jsdom',
    globals: true,
    include: ['base-ui/packages/react/src/separator/Separator.test.tsx'],
    setupFiles: [tooling('fixture-setup.ts')],
    reporters: ['default'],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
