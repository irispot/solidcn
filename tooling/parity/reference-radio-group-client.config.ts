import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-all.config.ts';

const file = 'base-ui/packages/react/src/radio-group/RadioGroup.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-radio-group-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
