import { resolve } from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

const root = resolve(import.meta.dirname, '../..');
const testFile = resolve(root, 'shadcn-ui/packages/react/src/message-scroller/message-scroller.test.tsx');
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller.tsx');
const tooling = (name: string) => resolve(import.meta.dirname, name);
const unchangedFixture: Plugin = {
  name: 'unchanged-shadcn-message-scroller-client-fixture',
  enforce: 'pre',
  resolveId(id, importer) {
    if (id === '.' && importer?.split('?')[0] === testFile) {
      console.log(`Solid message-scroller route: ${nativeSource}`);
      return tooling('shadcn-message-scroller-route.ts');
    }
  },
  async transform(code, id) {
    if (id.split('?')[0] !== testFile) return;
    return transformWithOxc(code, id, {
      sourceType: 'module',
      jsx: { runtime: 'automatic', importSource: '@solid-cn/parity-fixture' },
    });
  },
};

export default defineConfig({
  root,
  plugins: [
    unchangedFixture,
    solid({
      hot: false,
      include: /\/(?:shadcn-ui|base-ui)\/packages\/solid\/src\/.+\.tsx?$/,
      solid: { generate: 'dom' },
    }),
  ],
  resolve: {
    conditions: ['browser', 'development'],
    alias: [
      { find: /^react$/, replacement: tooling('shadcn-message-scroller-react-ssr.ts') },
      { find: /^react-dom\/client$/, replacement: tooling('shadcn-message-scroller-dom-client.ts') },
      { find: /^react-dom\/server$/, replacement: tooling('shadcn-questionnaire-dom-dual.ts') },
      {
        find: /^@solid-cn\/parity-fixture\/jsx(?:-dev)?-runtime$/,
        replacement: tooling('fixture-runtime.ts'),
      },
    ],
  },
  test: {
    name: 'unchanged-shadcn-message-scroller-native-solid-client',
    environment: 'jsdom',
    include: ['shadcn-ui/packages/react/src/message-scroller/message-scroller.test.tsx'],
    testNamePattern: '^MessageScroller > (?!emits data-pending-scroll|does not emit data-pending-scroll|clears data-pending-scroll|converges after a pre-hydration)',
    maxWorkers: 1,
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
