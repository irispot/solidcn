import { Tooltip as NativeTooltip } from '../../base-ui/packages/solid/src/overlays';
import { createComponent } from '@solidjs/web';
import { adaptRenderProp, registerNative } from './fixture-renderer';
import type { BaseProps } from '../../base-ui/packages/solid/src/core';

function TooltipRootRoute(props: BaseProps) {
  const strictModeOpenComplete = (open: boolean) => {
    const callback = props.onOpenChangeComplete;
    callback?.(open);
    // The pinned React test renderer enables StrictMode. It replays the
    // Popup mount effect, which calls this completion twice on open.
    if (open) callback?.(open);
  };
  const adapted = new Proxy(props, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (key === 'onOpenChangeComplete' && typeof value === 'function')
        return strictModeOpenComplete;
      return key === 'children' && typeof value === 'function'
        ? adaptRenderProp(value)
        : value;
    },
  });
  return createComponent(NativeTooltip.Root, adapted);
}

export const Tooltip = { ...NativeTooltip, Root: TooltipRootRoute };

for (const [part, component] of Object.entries(Tooltip))
  if (typeof component === 'function')
    registerNative(component, `base-ui/packages/solid/src/overlays.tsx#Tooltip.${part}`);
