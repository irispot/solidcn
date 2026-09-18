import './fixture-setup';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { createServer } from 'vite';
import solid from '@solidjs/vite-plugin';

const root = resolve(import.meta.dirname, '../..');
const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [solid({
    hot: false,
    include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/,
    solid: { generate: 'ssr', hydratable: true },
  })],
  resolve: {
    conditions: ['node', 'development'],
    alias: [
      { find: /^@solidjs\/web$/, replacement: resolve(root, 'node_modules/@solidjs/web/dist/server.dev.js') },
      { find: /^solid-js$/, replacement: resolve(root, 'node_modules/solid-js/dist/server.js') },
    ],
  },
});
const service = await server.ssrLoadModule('/tooling/parity/checkbox-hydration-ssr-service.ts');
(globalThis as any).__solidCnCheckboxSsr = service.renderCheckboxToString;
afterAll(async () => {
  delete (globalThis as any).__solidCnCheckboxSsr;
  await server.close();
});
