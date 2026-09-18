import { Toolbar as NativeToolbar } from '../../base-ui/packages/solid/src/structure';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeToolbar))
  registerNative(component, `base-ui/packages/solid/src/structure.tsx#Toolbar.${part}`);

export const Toolbar = NativeToolbar;
