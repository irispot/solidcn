import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');

// Run pinned, unchanged @shadcn/react tests with the workspace Vitest toolchain.
// Browser-mode files have a separate runner because jsdom cannot test scrolling.
export default defineConfig({
  root,
  test: {
    name: 'unchanged-shadcn-react-jsdom',
    environment: 'jsdom',
    include: [
      'shadcn-ui/packages/react/src/message-scroller/geometry.test.ts',
      'shadcn-ui/packages/react/src/message-scroller/message-scroller.test.tsx',
      'shadcn-ui/packages/react/src/questionnaire/questionnaire.test.tsx',
      'shadcn-ui/packages/react/src/questionnaire/questionnaire-ssr.test.tsx',
    ],
    maxWorkers: 2,
    minWorkers: 1,
  },
});
