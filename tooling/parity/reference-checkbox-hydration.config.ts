import { mergeConfig } from 'vitest/config';
import config from './reference-checkbox-client.config.ts';

export default mergeConfig(config, {
  test: {
    name: 'unchanged-checkbox-react-ssr-hydration',
    testNamePattern: 'defers an explicit id until hydration',
  },
});
