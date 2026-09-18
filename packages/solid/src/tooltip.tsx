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
import { Tooltip as TooltipPrimitive } from '@solid-cn/base-ui/tooltip';
import { cn } from './utils';
function TooltipProvider(__props0: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={__props0.delay === undefined ? 0 : __props0.delay}
      {...omitProps(__props0, ['delay'])}
    />
  );
}
function Tooltip(__props1: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...omitProps(__props1, [])} />;
}
function TooltipTrigger(__props2: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...omitProps(__props2, [])} />;
}
function TooltipContent(
  __props3: ComponentProps<typeof TooltipPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof TooltipPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
      >
    >,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={__props3.align === undefined ? 'center' : __props3.align}
        alignOffset={__props3.alignOffset === undefined ? 0 : __props3.alignOffset}
        side={__props3.side === undefined ? 'top' : __props3.side}
        sideOffset={__props3.sideOffset === undefined ? 4 : __props3.sideOffset}
        class="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          class={cn(
            'cn-tooltip-content cn-tooltip-content-logical z-50 w-fit max-w-xs origin-(--transform-origin) bg-foreground text-background',
            __props3.className ?? __props3.class,
          )}
          {...omitProps(__props3, [
            'className',
            'side',
            'sideOffset',
            'align',
            'alignOffset',
            'children',
          ])}
        >
          {__props3.children}
          <TooltipPrimitive.Arrow class="cn-tooltip-arrow cn-tooltip-arrow-logical z-50 bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
