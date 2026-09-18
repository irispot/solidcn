import { mergeConfig } from 'vitest/config';
import config from './separator.config.ts';

const probe = mergeConfig(config, {
  test: {
    name: 'native-popover-controlled-probe',
    include: ['tooling/parity/popover-native-controlled-probe.test.ts'],
  },
});
probe.test!.include = ['tooling/parity/popover-native-controlled-probe.test.ts'];
export default probe;
