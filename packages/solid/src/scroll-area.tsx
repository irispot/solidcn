import { dataValue } from './utils';
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
import { ScrollArea as ScrollAreaPrimitive } from '@solid-cn/base-ui/scroll-area';
import { cn } from './utils';
function ScrollArea(__props0: ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      class={cn('cn-scroll-area relative', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className', 'children'])}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        class="cn-scroll-area-viewport size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {__props0.children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
function ScrollBar(__props1: ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={dataValue(
        __props1.orientation === undefined ? 'vertical' : __props1.orientation,
      )}
      orientation={__props1.orientation === undefined ? 'vertical' : __props1.orientation}
      class={cn(
        'cn-scroll-area-scrollbar flex touch-none p-px transition-colors select-none',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className', 'orientation'])}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        class="cn-scroll-area-thumb relative flex-1 bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
export { ScrollArea, ScrollBar };
