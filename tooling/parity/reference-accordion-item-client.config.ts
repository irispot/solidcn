import { mergeConfig } from 'vitest/config';
import referenceConfig from './reference-accordion-header-client.config.ts';

const file = 'base-ui/packages/react/src/accordion/item/AccordionItem.test.tsx';
const config = mergeConfig(referenceConfig, {
  test: { name: 'unchanged-accordion-item-react-client', include: [file] },
});
config.test!.include = [file];
export default config;
