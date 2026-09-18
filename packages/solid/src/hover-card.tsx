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
import { PreviewCard as PreviewCardPrimitive } from '@solid-cn/base-ui/preview-card';
import { cn } from './utils';
function HoverCard(__props0: ComponentProps<typeof PreviewCardPrimitive.Root>) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...omitProps(__props0, [])} />;
}
function HoverCardTrigger(__props1: ComponentProps<typeof PreviewCardPrimitive.Trigger>) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...omitProps(__props1, [])} />
  );
}
function HoverCardContent(
  __props2: ComponentProps<typeof PreviewCardPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof PreviewCardPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
      >
    >,
) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={__props2.align === undefined ? 'center' : __props2.align}
        alignOffset={__props2.alignOffset === undefined ? 4 : __props2.alignOffset}
        side={__props2.side === undefined ? 'bottom' : __props2.side}
        sideOffset={__props2.sideOffset === undefined ? 4 : __props2.sideOffset}
        class="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          class={cn(
            'cn-hover-card-content cn-hover-card-content-logical z-50 origin-(--transform-origin) outline-hidden',
            __props2.className ?? __props2.class,
          )}
          {...omitProps(__props2, ['className', 'side', 'sideOffset', 'align', 'alignOffset'])}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}
export { HoverCard, HoverCardTrigger, HoverCardContent };
