import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const files = [
  'base-ui/packages/react/src/switch/root/SwitchRoot.test.tsx',
  'base-ui/packages/react/src/switch/thumb/SwitchThumb.test.tsx',
];
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-switch-react-client', include: files },
});
config.test!.include = files;
export default config;
