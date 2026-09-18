import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-solid.config.ts';

const file = 'base-ui/packages/react/src/checkbox/indicator/CheckboxIndicator.test.tsx';
const config = mergeConfig(solidConfig, {
  test: { name: 'unchanged-checkbox-indicator-native-solid-client', include: [file] },
});
config.test!.include = [file];
config.resolve!.alias = [
  { find: /^\.\.\/root\/CheckboxRootContext$/, replacement: resolve(import.meta.dirname, 'checkbox-context-route.ts') },
  { find: /^react-dom$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-dom.ts') },
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/checkbox$/, replacement: resolve(import.meta.dirname, 'fieldset-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
