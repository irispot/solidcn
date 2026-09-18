import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';

const file = 'base-ui/packages/react/src/toolbar/root/ToolbarRoot.test.tsx';
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-toolbar-native-solid-client-diagnostic', include: [file] },
});
config.test!.include = [file];
config.resolve!.alias = [
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/toolbar$/, replacement: resolve(import.meta.dirname, 'toolbar-route.ts') },
  { find: /^@base-ui\/react\/direction-provider$/, replacement: resolve(import.meta.dirname, 'ssr-additional-route.ts') },
  { find: /^\.\/ToolbarRootContext$/, replacement: resolve(import.meta.dirname, 'toolbar-context-diagnostic.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
