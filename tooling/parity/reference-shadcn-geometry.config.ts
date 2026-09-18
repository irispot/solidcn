import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root,
  test: {
    name: 'unchanged-shadcn-geometry-react',
    environment: 'jsdom',
    include: ['shadcn-ui/packages/react/src/message-scroller/geometry.test.ts'],
    maxWorkers: 1,
  },
});
