import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import solidSsrConfig from './dual-ssr-solid.config.ts';
import { navigationSsrTestFile, navigationSsrTestName } from './navigation-ssr-selected.mjs';

const config = mergeConfig(solidSsrConfig, {
  test: {
    name: 'unchanged-navigation-native-solid-ssr',
    include: [navigationSsrTestFile],
    testNamePattern: navigationSsrTestName,
  },
});

config.test!.include = [navigationSsrTestFile];
config.resolve!.alias = [
  {
    find: /^@base-ui\/react\/navigation-menu$/,
    replacement: resolve(import.meta.dirname, 'navigation-ssr-route.ts'),
  },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
