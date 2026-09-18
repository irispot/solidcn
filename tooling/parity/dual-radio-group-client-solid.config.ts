import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import nativeConfig from './dual-checkbox-client-solid.config.ts';

const file = 'base-ui/packages/react/src/radio-group/RadioGroup.test.tsx';
const config = mergeConfig(nativeConfig, {
  test: { name: 'unchanged-radio-group-native-solid-client', include: [file] },
});
config.test!.include = [file];
config.resolve!.alias = [
  { find: /^react$/, replacement: resolve(import.meta.dirname, 'radio-fixture-runtime.ts') },
  { find: /^@base-ui\/react\/radio$/, replacement: resolve(import.meta.dirname, 'radio-route.ts') },
  { find: /^@base-ui\/react\/direction-provider$/, replacement: resolve(import.meta.dirname, 'ssr-additional-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
