import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-all.config.ts';

const file = 'base-ui/packages/react/src/scroll-area/root/ScrollAreaRoot.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-scroll-area-root-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
