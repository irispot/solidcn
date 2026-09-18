import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference.config.ts';
import { toastPartFiles } from './toast-part-files.mjs';

const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-toast-parts-react-client-reference', include: toastPartFiles },
});
config.test!.include = toastPartFiles;
export default config;
