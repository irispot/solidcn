import { mergeConfig } from 'vitest/config';
import config from './reference-tabs-client.config.ts';

const file = 'base-ui/packages/react/src/tabs/indicator/TabsIndicator.test.tsx';
const hydrationConfig = mergeConfig(config, {
  test: {
    name: 'unchanged-tabs-indicator-react-ssr-hydration',
    testNamePattern: 'pre-hydration rendering',
    include: [file],
  },
});
hydrationConfig.test!.include = [file];
export default hydrationConfig;
