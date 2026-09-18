import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');
const originalTest = resolve(root, 'shadcn-ui/packages/react/src/message-scroller/geometry.test.ts');
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller/geometry.ts');

export default defineConfig({
  root,
  plugins: [{
    name: 'exact-unchanged-shadcn-geometry-route',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === './geometry' && importer?.split('?')[0] === originalTest) {
        console.log(`Solid geometry route: ${nativeSource}`);
        return nativeSource;
      }
    },
    transform(code, id) {
      if (id.split('?')[0] === nativeSource) {
        console.log(`Solid geometry source loaded: ${nativeSource}`);
      }
      return null;
    },
  }],
  test: {
    name: 'unchanged-shadcn-geometry-solid',
    environment: 'jsdom',
    include: ['shadcn-ui/packages/react/src/message-scroller/geometry.test.ts'],
    maxWorkers: 1,
  },
});
