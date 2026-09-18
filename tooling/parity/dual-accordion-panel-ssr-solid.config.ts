import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidSsrConfig from './dual-ssr-solid.config.ts';

const file = 'base-ui/packages/react/src/accordion/panel/AccordionPanel.test.tsx';
const config = mergeConfig(solidSsrConfig, {
  test: {
    name: 'unchanged-accordion-panel-native-solid-ssr',
    include: [file],
    testNamePattern: 'suppresses the initial keyframe animation from inline styles when rendered open',
  },
});
config.test!.include = [file];
config.resolve!.alias = [
  { find: /^@mui\/internal-test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-mui-entry.ts') },
  { find: /^#test-utils$/, replacement: resolve(import.meta.dirname, 'select-client-fixture-entry.ts') },
  { find: /^@base-ui\/react\/accordion$/, replacement: resolve(import.meta.dirname, 'accordion-route.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
