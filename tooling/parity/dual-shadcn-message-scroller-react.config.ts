import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  test: {
    name: 'unchanged-shadcn-message-scroller-reference-react',
    environment: 'jsdom',
    include: ['shadcn-ui/packages/react/src/message-scroller/message-scroller.test.tsx'],
    maxWorkers: 1,
  },
});
