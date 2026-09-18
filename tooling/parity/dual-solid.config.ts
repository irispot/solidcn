import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import componentsConfig from './components.config.ts';
import { selectedTests } from './selected-tests.mjs';
import { sourceAudit } from './source-audit.ts';

export default mergeConfig(componentsConfig, {
  plugins: [sourceAudit('solid')],
  resolve: {
    alias: [
      {
        find: /^@base-ui\/react\/merge-props$/,
        replacement: resolve(import.meta.dirname, '../../base-ui/packages/solid/src/merge-props/index.ts'),
      },
    ],
  },
  test: {
    name: 'unchanged-selected-native-solid',
    include: selectedTests,
  },
});
