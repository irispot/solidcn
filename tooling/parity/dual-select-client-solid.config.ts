import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';
import { selectSsrTestFile } from './select-ssr-selected.mjs';

const config = mergeConfig(solidConfig, {
  test: {
    name: 'unchanged-select-native-solid-all-cases',
    include: [selectSsrTestFile],
  },
});
config.test!.include = [selectSsrTestFile];
config.resolve!.alias = [
  {
    find: /^react-dom$/,
    replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts'),
  },
  {
    find: /^@mui\/internal-test-utils$/,
    replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts'),
  },
  {
    find: /^#test-utils$/,
    replacement: resolve(import.meta.dirname, 'select-client-fixture-entry.ts'),
  },
  {
    find: /^@base-ui\/react\/(?:select|popover|field|form)$/,
    replacement: resolve(import.meta.dirname, 'select-ssr-route.ts'),
  },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
