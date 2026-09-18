import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';
import { toastPartFiles } from './toast-part-files.mjs';

const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-toast-parts-native-solid-client', include: toastPartFiles },
});
config.test!.include = toastPartFiles;
config.resolve!.alias = [
  { find: /^react$/, replacement: resolve(import.meta.dirname, 'toast-fixture-runtime.ts') },
  { find: /^@solid-cn\/parity-fixture$/, replacement: resolve(import.meta.dirname, 'toast-fixture-runtime.ts') },
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'toast-fixture-entry.ts') },
  { find: /^@base-ui\/react\/toast$/, replacement: resolve(import.meta.dirname, 'toast-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
