// Native Solid 2 port of the upstream Base UI registry.
import {
  createSignal,
  createMemo,
  createEffect,
  createContext,
  useContext,
  createUniqueId,
  type Component,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from './utils';
import { Popover as PopoverPrimitive } from '@solid-cn/base-ui/popover';
import { cn } from './utils';
function Popover(__props0: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...omitProps(__props0, [])} />;
}
function PopoverTrigger(__props1: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...omitProps(__props1, [])} />;
}
function PopoverContent(
  __props2: ComponentProps<typeof PopoverPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof PopoverPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
      >
    >,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={__props2.align === undefined ? 'center' : __props2.align}
        alignOffset={__props2.alignOffset === undefined ? 0 : __props2.alignOffset}
        side={__props2.side === undefined ? 'bottom' : __props2.side}
        sideOffset={__props2.sideOffset === undefined ? 4 : __props2.sideOffset}
        class="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          class={cn(
            'cn-popover-content cn-popover-content-logical z-50 w-72 origin-(--transform-origin) outline-hidden',
            __props2.className ?? __props2.class,
          )}
          {...omitProps(__props2, ['className', 'align', 'alignOffset', 'side', 'sideOffset'])}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
function PopoverHeader(__props3: ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      class={cn('cn-popover-header', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function PopoverTitle(__props4: ComponentProps<typeof PopoverPrimitive.Title>) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      class={cn('cn-popover-title', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function PopoverDescription(__props5: ComponentProps<typeof PopoverPrimitive.Description>) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      class={cn('cn-popover-description', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
