import { resolve } from 'node:path';
import { transformWithOxc, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

const root = resolve(import.meta.dirname, '../..');
const testFile = resolve(root, 'shadcn-ui/packages/react/src/questionnaire/questionnaire-ssr.test.tsx');
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/questionnaire.tsx');
const tooling = (name: string) => resolve(import.meta.dirname, name);
const unchangedFixture: Plugin = {
  name: 'unchanged-shadcn-questionnaire-hydration-fixture',
  enforce: 'pre',
  resolveId(id, importer) {
    if (id === '.' && importer?.split('?')[0] === testFile) {
      console.log(`Solid questionnaire route: ${nativeSource}`);
      return tooling('shadcn-questionnaire-route.ts');
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
      solid: { generate: 'dom', hydratable: true },
    }),
  ],
  resolve: {
    conditions: ['browser', 'development'],
    alias: [
      { find: /^react$/, replacement: tooling('shadcn-questionnaire-react-ssr.ts') },
      { find: /^react-dom\/server$/, replacement: tooling('shadcn-questionnaire-dom-dual.ts') },
      { find: /^react-dom\/client$/, replacement: tooling('shadcn-questionnaire-dom-hydrate.ts') },
      { find: /^@solid-cn\/parity-fixture\/jsx(?:-dev)?-runtime$/, replacement: tooling('fixture-runtime.ts') },
    ],
  },
  test: {
    name: 'unchanged-shadcn-questionnaire-native-solid-hydration',
    environment: 'jsdom',
    include: ['shadcn-ui/packages/react/src/questionnaire/questionnaire-ssr.test.tsx'],
    testNamePattern: '^Questionnaire hydration',
    setupFiles: [tooling('shadcn-questionnaire-hydration-setup.ts')],
    maxWorkers: 1,
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
