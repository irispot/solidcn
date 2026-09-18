import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const files = [
  'base-ui/packages/react/src/checkbox-group/CheckboxGroup.test.tsx',
  'base-ui/packages/react/src/checkbox-group/useCheckboxGroupParent.test.tsx',
];
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-checkbox-group-react-client', include: files },
});
config.test!.include = files;
export default config;
