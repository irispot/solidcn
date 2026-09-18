import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';
import { ssrTestFile, ssrTestName } from './ssr-selected.mjs';

const config = mergeConfig(referenceConfig, {
  test: {
    name: 'unchanged-slider-react-reference-ssr',
    include: [ssrTestFile],
    testNamePattern: ssrTestName,
  },
});

// Vite concatenates include arrays during merge. The SSR run has one source file.
config.test!.include = [ssrTestFile];
export default config;
