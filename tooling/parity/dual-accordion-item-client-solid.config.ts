import { mergeConfig } from 'vitest/config';
import headerConfig from './dual-accordion-header-client-solid.config.ts';

const file = 'base-ui/packages/react/src/accordion/item/AccordionItem.test.tsx';
const config = mergeConfig(headerConfig, {
  test: { name: 'unchanged-accordion-item-native-solid-client', include: [file] },
});
config.test!.include = [file];
export default config;
