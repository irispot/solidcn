import { mergeConfig } from 'vitest/config';
import config from './dual-accordion-root-browser-solid.config.ts';

// The selected case runs with real Solid SSR and hydration in its own route.
export default mergeConfig(config, {
  test: {
    name: 'unchanged-accordion-root-native-solid-browser-runtime',
    testNamePattern: '^(?!.*preserves generated part associations during hydration)',
  },
});
