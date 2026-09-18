import { ScrollArea as NativeScrollArea } from '../../base-ui/packages/solid/src/structure';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeScrollArea))
  registerNative(component, `base-ui/packages/solid/src/structure.tsx#ScrollArea.${part}`);

export const ScrollArea = NativeScrollArea;
