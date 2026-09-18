import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';
import { selectPartTests } from './select-parts-selected.mjs';

const config = mergeConfig(referenceConfig, {
  test: {
    name: 'unchanged-select-parts-react-reference',
    include: selectPartTests,
  },
});
config.test!.include = selectPartTests;
export default config;
