import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const file = 'base-ui/packages/react/src/checkbox/indicator/CheckboxIndicator.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-checkbox-indicator-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
