import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');
const tests = new Set(['getPushedThumbValues', 'getSliderValue', 'resolveThumbCollision', 'roundValueToStep']);
const originalDirectory = resolve(root, 'base-ui/packages/react/src/slider/utils');
const nativeDirectory = resolve(root, 'base-ui/packages/solid/src/slider/utils');

export default defineConfig({
  root,
  plugins: [{
    name: 'unchanged-slider-utils-native-route',
    enforce: 'pre',
    resolveId(id, importer) {
      const part = id.match(/^\.\/(\w+)$/)?.[1];
      if (part && tests.has(part) && importer?.split('?')[0] === resolve(originalDirectory, `${part}.test.ts`)) {
        const native = resolve(nativeDirectory, `${part}.ts`);
        console.log(`Native slider helper route: ${native}`);
        return native;
      }
    },
    transform(code, id) {
      const path = id.split('?')[0];
      if (path.startsWith(`${nativeDirectory}/`) && path.endsWith('.ts'))
        console.log(`Native slider helper loaded: ${path}`);
      return null;
    },
  }],
  test: {
    name: 'unchanged-slider-utils-solid',
    environment: 'jsdom',
    include: ['base-ui/packages/react/src/slider/utils/*.test.ts'],
    maxWorkers: 1,
  },
});
