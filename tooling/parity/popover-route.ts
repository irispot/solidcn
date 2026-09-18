import { Popover as NativePopover } from '../../base-ui/packages/solid/src/overlays';
import { createComponent } from '@solidjs/web';
import { adaptRenderProp, registerNative } from './fixture-renderer';
import type { BaseProps } from '../../base-ui/packages/solid/src/core';

function PopoverRootRoute(props: BaseProps) {
  const adapted = new Proxy(props, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      return key === 'children' && typeof value === 'function'
        ? adaptRenderProp(value)
        : value;
    },
  });
  return createComponent(NativePopover.Root, adapted);
}

// Only the unchanged Popover test import crosses this route.
export const Popover = { ...NativePopover, Root: PopoverRootRoute };

for (const [part, component] of Object.entries(Popover))
  if (typeof component === 'function')
    registerNative(component, `base-ui/packages/solid/src/overlays.tsx#Popover.${part}`);
