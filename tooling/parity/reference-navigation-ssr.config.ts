import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';
import { navigationSsrTestFile, navigationSsrTestName } from './navigation-ssr-selected.mjs';

const config = mergeConfig(referenceConfig, {
  test: {
    name: 'unchanged-navigation-react-reference-ssr',
    include: [navigationSsrTestFile],
    testNamePattern: navigationSsrTestName,
  },
});

// Vite joins include arrays during merge.
config.test!.include = [navigationSsrTestFile];
export default config;
