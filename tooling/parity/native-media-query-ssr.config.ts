import { resolve } from 'node:path';
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '../..');
export default defineConfig({
  root,
  plugins: [solid({
    hot: false,
    include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/,
    solid: { generate: 'ssr' },
  })],
  resolve: {
    conditions: ['node', 'development'],
    alias: [
      { find: /^@solidjs\/web$/, replacement: resolve(root, 'node_modules/@solidjs/web/dist/server.dev.js') },
      { find: /^solid-js$/, replacement: resolve(root, 'node_modules/solid-js/dist/server.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tooling/parity/native-media-query-ssr.test.ts'],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
