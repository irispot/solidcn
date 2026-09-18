import { Menu as NativeMenu } from '../../base-ui/packages/solid/src/overlays';
import { Combobox as NativeCombobox } from '../../base-ui/packages/solid/src/selection';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeMenu))
  if (typeof component === 'function')
    registerNative(component, `base-ui/packages/solid/src/overlays.tsx#Menu.${part}`);
for (const [part, component] of Object.entries(NativeCombobox))
  if (typeof component === 'function')
    registerNative(component, `base-ui/packages/solid/src/selection.tsx#Combobox.${part}`);

export const Menu = NativeMenu;
export const Combobox = NativeCombobox;
