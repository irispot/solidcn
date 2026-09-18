import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';

const files = [
  'base-ui/packages/react/src/switch/root/SwitchRoot.test.tsx',
  'base-ui/packages/react/src/switch/thumb/SwitchThumb.test.tsx',
];
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-switch-native-solid-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^\.\.\/root\/SwitchRootContext$/, replacement: resolve(import.meta.dirname, 'switch-context-route.ts') },
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/switch$/, replacement: resolve(import.meta.dirname, 'switch-route.ts') },
  { find: /^@base-ui\/react\/form$/, replacement: resolve(import.meta.dirname, 'ssr-additional-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
