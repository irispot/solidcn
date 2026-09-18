import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const file = 'base-ui/packages/react/src/tabs/root/TabsRoot.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-tabs-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
