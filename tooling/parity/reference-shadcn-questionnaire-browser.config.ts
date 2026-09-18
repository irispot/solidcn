import { mergeConfig } from 'vitest/config';
import referenceConfig from './shadcn-browser-deps/reference.config.ts';

const file = 'shadcn-ui/packages/react/src/questionnaire/questionnaire.browser.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-shadcn-questionnaire-react-chromium', include: [file] },
});
config.test!.include = [file];
export default config;
