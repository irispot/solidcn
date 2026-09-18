import { mergeConfig } from 'vitest/config';
import config from './dual-tabs-indicator-browser-solid.config.ts';

export default mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-indicator-native-solid-browser-runtime',
    testNamePattern: '^(?!.*pre-hydration rendering.*(?:renders the inline pre-hydration script|applies the CSP nonce))',
  },
});
