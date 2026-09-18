import { Tabs as NativeTabs } from '../../base-ui/packages/solid/src/structure';
import { Dialog as NativeDialog, Popover as NativePopover } from '../../base-ui/packages/solid/src/overlays';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeTabs))
  registerNative(component, `base-ui/packages/solid/src/structure.tsx#Tabs.${part}`);

export const Tabs = NativeTabs;
for (const [family, parts] of [['Dialog', NativeDialog], ['Popover', NativePopover]] as const)
  for (const [part, component] of Object.entries(parts))
    if (typeof component === 'function')
      registerNative(component, `base-ui/packages/solid/src/overlays.tsx#${family}.${part}`);
export const Dialog = NativeDialog;
export const Popover = NativePopover;
