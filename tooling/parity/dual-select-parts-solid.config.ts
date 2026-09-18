import { mergeConfig } from 'vitest/config';
import selectConfig from './dual-select-client-solid.config.ts';
import { selectPartTests } from './select-parts-selected.mjs';

// The original files and conformance assertions remain unchanged. Extend the
// same native Select route one source file at a time as its full suite passes.
const config = mergeConfig(selectConfig, {
  test: {
    name: 'unchanged-select-parts-native-solid',
    include: selectPartTests,
  },
});
config.test!.include = selectPartTests;
export default config;
