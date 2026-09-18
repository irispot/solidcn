import { mergeConfig } from 'vitest/config';
import referenceConfig from './shadcn-browser-deps/reference.config.ts';

const file = 'shadcn-ui/packages/react/src/message-scroller/message-scroller.perf.browser.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-shadcn-message-scroller-react-perf-chromium', include: [file] },
});
config.test!.include = [file];
export default config;
