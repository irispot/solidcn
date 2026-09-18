import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root,
  resolve: {
    alias: [{
      find: /^@base-ui\/utils\/(.+)$/,
      replacement: `${root}/base-ui/packages/utils/src/$1.ts`,
    }],
  },
  test: {
    name: 'unchanged-slider-utils-react',
    environment: 'jsdom',
    include: ['base-ui/packages/react/src/slider/utils/*.test.ts'],
    maxWorkers: 1,
  },
});
