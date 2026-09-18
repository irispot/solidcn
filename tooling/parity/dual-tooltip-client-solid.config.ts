import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';

const files = [
  'base-ui/packages/react/src/tooltip/provider/TooltipProvider.test.tsx',
  'base-ui/packages/react/src/tooltip/root/TooltipRoot.test.tsx',
];
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-tooltip-native-solid-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'tooltip-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/tooltip$/, replacement: resolve(import.meta.dirname, 'tooltip-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
