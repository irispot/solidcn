import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-navigation-ssr.config.ts';

const testFile = 'tooling/parity/navigation-hidden-probe.test.ts';
const config = mergeConfig(referenceConfig, {
  test: { name: 'navigation-hidden-react-reference', include: [testFile] },
});
config.test!.include = [testFile];
export default config;
