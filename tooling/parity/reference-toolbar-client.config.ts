import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const file = 'base-ui/packages/react/src/toolbar/root/ToolbarRoot.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-toolbar-react-client-diagnostic', include: [file] },
});
config.test!.include = [file];
export default config;
