import { resolve } from 'node:path';
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
    include: /\/(?:shadcn-ui|base-ui)\/packages\/solid\/src\/.+\.tsx?$/,
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

const service = await server.ssrLoadModule(
  '/tooling/parity/shadcn-questionnaire-ssr-service.ts',
);
(globalThis as any).__solidCnQuestionnaireSsr = service.renderQuestionnaireToString;

import { afterAll } from 'vitest';
afterAll(async () => {
  delete (globalThis as any).__solidCnQuestionnaireSsr;
  await server.close();
});
