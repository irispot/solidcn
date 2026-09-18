import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
export default defineConfig({
  root,
  plugins: [solid({ hot: false })],
  resolve: {
    alias: [{ find: /^@base-ui\/react\/(.*)$/, replacement: resolve(root, 'base-ui/packages/solid/src/$1/index.ts') }],
  },
  test: {
    environment: 'jsdom',
    include: ['base-ui/packages/react/src/merge-props/mergeProps.test.ts'],
    reporters: ['default'],
  },
});
