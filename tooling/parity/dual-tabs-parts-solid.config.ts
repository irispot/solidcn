import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-tabs-client-solid.config.ts';

const files = [
  'base-ui/packages/react/src/tabs/list/TabsList.test.tsx',
  'base-ui/packages/react/src/tabs/tab/TabsTab.test.tsx',
  'base-ui/packages/react/src/tabs/panel/TabsPanel.test.tsx',
  'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx',
];
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-tabs-parts-native-solid-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^react-router$/, replacement: resolve(import.meta.dirname, 'tabs-router-fixture.ts') },
  { find: /^@base-ui\/react\/csp-provider$/, replacement: resolve(import.meta.dirname, 'tabs-additional-route.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'tabs-parts-fixture-entry.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
