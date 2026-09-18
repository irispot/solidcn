import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import type { Alias } from 'vite';
import referenceConfig from './reference.config.ts';

const files = ['base-ui/packages/react/src/popover/trigger/PopoverTrigger.test.tsx'];
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-popover-trigger-react-client', include: files },
});
config.test!.include = files;
config.resolve!.alias = [
  { find: /^vitest-browser-react$/, replacement: resolve(import.meta.dirname, 'reference-deps/node_modules/vitest-browser-react') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
