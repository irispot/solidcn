import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';

const file = 'base-ui/packages/react/src/slider/root/SliderRoot.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-slider-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
