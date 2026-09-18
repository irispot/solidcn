import { Accordion as NativeAccordion } from '../../base-ui/packages/solid/src/structure';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeAccordion))
  registerNative(component, `base-ui/packages/solid/src/structure.tsx#Accordion.${part}`);

export const Accordion = NativeAccordion;
