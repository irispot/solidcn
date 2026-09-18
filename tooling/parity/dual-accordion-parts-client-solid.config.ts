import { mergeConfig } from 'vitest/config';
import headerConfig from './dual-accordion-header-client-solid.config.ts';

const files = [
  'base-ui/packages/react/src/accordion/header/AccordionHeader.test.tsx',
  'base-ui/packages/react/src/accordion/item/AccordionItem.test.tsx',
  'base-ui/packages/react/src/accordion/panel/AccordionPanel.test.tsx',
  'base-ui/packages/react/src/accordion/trigger/AccordionTrigger.test.tsx',
];
const config = mergeConfig(headerConfig, {
  test: {
    name: 'unchanged-accordion-parts-native-solid-client',
    include: files,
    testNamePattern: '^(?!.*suppresses the initial keyframe animation from inline styles when rendered open).*$'
  },
});
config.test!.include = files;
export default config;
