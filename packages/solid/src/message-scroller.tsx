import { mergeRenderProps } from './utils';
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
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from './internal/message-scroller';
import { cn } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
function MessageScrollerProvider(props: ComponentProps<typeof MessageScrollerPrimitive.Provider>) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}
function MessageScroller(__props0: ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      class={cn(
        'cn-message-scroller group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function MessageScrollerViewport(
  __props1: ComponentProps<typeof MessageScrollerPrimitive.Viewport>,
) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      class={cn(
        'cn-message-scroller-viewport size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent data-pending-scroll:invisible',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function MessageScrollerContent(__props2: ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      class={cn(
        'cn-message-scroller-content flex h-max min-h-full flex-col',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function MessageScrollerItem(__props3: ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={__props3.scrollAnchor === undefined ? false : __props3.scrollAnchor}
      class={cn(
        'cn-message-scroller-item min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className', 'scrollAnchor'])}
    />
  );
}
function MessageScrollerButton(
  __props4: ComponentProps<typeof MessageScrollerPrimitive.Button> &
    Partial<Pick<ComponentProps<typeof Button>, 'variant' | 'size'>>,
) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={dataValue(__props4.direction === undefined ? 'end' : __props4.direction)}
      data-variant={dataValue(__props4.variant === undefined ? 'secondary' : __props4.variant)}
      data-size={dataValue(__props4.size === undefined ? 'icon-sm' : __props4.size)}
      direction={__props4.direction === undefined ? 'end' : __props4.direction}
      class={cn(
        'cn-message-scroller-button absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180',
        __props4.className ?? __props4.class,
      )}
      render={
        __props4.render ??
        ((renderProps: Record<string, any>) => (
          <Button
            {...mergeRenderProps(
              renderProps,
              {
                get variant() {
                  return __props4.variant === undefined ? 'secondary' : __props4.variant;
                },
              },
              {
                get size() {
                  return __props4.size === undefined ? 'icon-sm' : __props4.size;
                },
              },
            )}
          />
        ))
      }
      {...omitProps(__props4, ['direction', 'className', 'children', 'render', 'variant', 'size'])}
    >
      {__props4.children ?? (
        <>
          <IconPlaceholder
            lucide="ArrowDownIcon"
            tabler="IconArrowDown"
            hugeicons="ArrowDown02Icon"
            phosphor="ArrowDownIcon"
            remixicon="RiArrowDownLine"
          />
          <span class="sr-only">
            {(__props4.direction === undefined ? 'end' : __props4.direction) === 'end'
              ? 'Scroll to end'
              : 'Scroll to start'}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}
export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
