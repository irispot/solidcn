import { mergeConfig } from 'vitest/config';
import ssrConfig from './ssr.config.ts';
import { sourceAudit } from './source-audit.ts';

export default mergeConfig(ssrConfig, {
  plugins: [sourceAudit('solid')],
});
