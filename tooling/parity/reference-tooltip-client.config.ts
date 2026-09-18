import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const files = [
  'base-ui/packages/react/src/tooltip/provider/TooltipProvider.test.tsx',
  'base-ui/packages/react/src/tooltip/root/TooltipRoot.test.tsx',
];
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-tooltip-react-client', include: files },
});
config.test!.include = files;
export default config;
