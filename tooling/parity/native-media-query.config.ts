import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  plugins: [solid({ hot: false })],
  test: {
    environment: 'jsdom',
    include: ['tooling/parity/native-media-query.test.ts'],
  },
});
