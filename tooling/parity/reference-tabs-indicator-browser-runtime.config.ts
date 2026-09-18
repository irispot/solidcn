import { mergeConfig } from 'vitest/config';
import config from './reference-tabs-indicator-browser.config.ts';

// These two SSR assertions run in the real Node SSR/hydration route. The browser
// cannot call renderToString directly; the other two SSR cases already skip there.
export default mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-indicator-react-browser-runtime',
    testNamePattern: '^(?!.*pre-hydration rendering.*(?:renders the inline pre-hydration script|applies the CSP nonce))',
  },
});
