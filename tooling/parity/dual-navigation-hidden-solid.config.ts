import { mergeConfig } from 'vitest/config';
import solidConfig from './dual-navigation-ssr-solid.config.ts';

const testFile = 'tooling/parity/navigation-hidden-probe.test.ts';
const config = mergeConfig(solidConfig, {
  test: { name: 'navigation-hidden-native-solid', include: [testFile] },
});
config.test!.include = [testFile];
export default config;
