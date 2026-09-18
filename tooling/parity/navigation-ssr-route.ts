import { NavigationMenu as NativeNavigationMenu } from '../../base-ui/packages/solid/src/overlays';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeNavigationMenu)) {
  registerNative(component, `base-ui/packages/solid/src/overlays.tsx#NavigationMenu.${part}`);
}

export const NavigationMenu = NativeNavigationMenu;
