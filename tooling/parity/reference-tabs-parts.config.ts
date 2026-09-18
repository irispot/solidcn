import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-tabs-client.config.ts';

const files = [
  'base-ui/packages/react/src/tabs/list/TabsList.test.tsx',
  'base-ui/packages/react/src/tabs/tab/TabsTab.test.tsx',
  'base-ui/packages/react/src/tabs/panel/TabsPanel.test.tsx',
  'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx',
];
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-tabs-parts-react-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^react-router$/, replacement: resolve(import.meta.dirname, 'reference-deps/node_modules/react-router/dist/development/index.js') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
