import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import checkboxConfig from './dual-checkbox-client-solid.config.ts';

const files = [
  'base-ui/packages/react/src/checkbox-group/CheckboxGroup.test.tsx',
  'base-ui/packages/react/src/checkbox-group/useCheckboxGroupParent.test.tsx',
];
const config = mergeConfig(checkboxConfig, {
  test: {
    name: 'unchanged-checkbox-group-native-solid-client',
    include: files,
    testNamePattern: '^(?!.*(?:during SSR|labels the group rather|points parent aria-controls)).*$',
  },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^@base-ui\/utils\/useIsoLayoutEffect$/, replacement: resolve(import.meta.dirname, 'checkbox-group-layout-effect.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
