import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-ssr.config.ts';

const file = 'base-ui/packages/react/src/accordion/panel/AccordionPanel.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: {
    name: 'unchanged-accordion-panel-react-ssr',
    include: [file],
    testNamePattern: 'suppresses the initial keyframe animation from inline styles when rendered open',
  },
});
config.test!.include = [file];
export default config;
