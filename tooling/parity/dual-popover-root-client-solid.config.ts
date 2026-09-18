import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import triggerConfig from './dual-popover-trigger-client-solid.config.ts';

const files = ['base-ui/packages/react/src/popover/root/PopoverRoot.test.tsx'];
const config = mergeConfig(triggerConfig, {
  test: { name: 'unchanged-popover-root-native-solid-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^react$/, replacement: resolve(import.meta.dirname, 'radio-fixture-runtime.ts') },
  { find: /^@base-ui\/react\/(?:combobox|menu)$/, replacement: resolve(import.meta.dirname, 'popover-dependent-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
