import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const file = 'base-ui/packages/react/src/checkbox/root/CheckboxRoot.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-checkbox-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
