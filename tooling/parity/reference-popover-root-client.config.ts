import { mergeConfig } from 'vitest/config';
import triggerConfig from './reference-popover-trigger-client.config.ts';

const files = ['base-ui/packages/react/src/popover/root/PopoverRoot.test.tsx'];
const config = mergeConfig(triggerConfig, {
  test: { name: 'unchanged-popover-root-react-client', include: files },
});
config.test!.include = files;
export default config;
