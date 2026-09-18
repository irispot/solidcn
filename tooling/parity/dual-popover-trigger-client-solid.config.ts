import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';

const files = ['base-ui/packages/react/src/popover/trigger/PopoverTrigger.test.tsx'];
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-popover-trigger-native-solid-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^vitest-browser-react$/, replacement: resolve(import.meta.dirname, 'reference-deps/node_modules/vitest-browser-react') },
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'popover-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'popover-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/popover$/, replacement: resolve(import.meta.dirname, 'popover-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
