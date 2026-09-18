import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';
import { selectSsrTestFile } from './select-ssr-selected.mjs';

const config = mergeConfig(referenceConfig, {
  test: {
    name: 'unchanged-select-react-all-cases',
    include: [selectSsrTestFile],
  },
});
config.test!.include = [selectSsrTestFile];
export default config;
