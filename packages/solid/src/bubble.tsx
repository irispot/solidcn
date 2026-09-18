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
import { mergeProps } from '@solid-cn/base-ui/merge-props';
import { useRender } from '@solid-cn/base-ui/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
function BubbleGroup(__props0: ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-group"
      class={cn('cn-bubble-group flex min-w-0 flex-col', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
const bubbleVariants = cva('cn-bubble group/bubble relative flex w-fit min-w-0 flex-col', {
  variants: {
    variant: {
      default: 'cn-bubble-variant-default',
      secondary: 'cn-bubble-variant-secondary',
      muted: 'cn-bubble-variant-muted',
      tinted: 'cn-bubble-variant-tinted',
      outline: 'cn-bubble-variant-outline',
      ghost: 'cn-bubble-variant-ghost',
      destructive: 'cn-bubble-variant-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
function Bubble(
  __props1: ComponentProps<'div'> &
    VariantProps<typeof bubbleVariants> & {
      align?: 'start' | 'end';
    },
) {
  return (
    <div
      data-slot="bubble"
      data-variant={dataValue(__props1.variant === undefined ? 'default' : __props1.variant)}
      data-align={dataValue(__props1.align === undefined ? 'start' : __props1.align)}
      class={cn(
        bubbleVariants({
          get variant() {
            return __props1.variant === undefined ? 'default' : __props1.variant;
          },
        }),
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['variant', 'align', 'className'])}
    />
  );
}
function BubbleContent(__props2: ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-bubble-content w-fit max-w-full min-w-0 overflow-hidden wrap-break-word [button]:text-left [button,a]:transition-colors',
              __props2.className ?? __props2.class,
            );
          },
        },
        omitProps(__props2, ['className', 'render']),
      );
    },
    get render() {
      return __props2.render;
    },
    get state() {
      return {
        slot: 'bubble-content',
      };
    },
  });
}
const bubbleReactionsVariants = cva(
  'cn-bubble-reactions absolute z-10 flex w-fit items-center justify-center',
  {
    variants: {
      side: {
        top: 'cn-bubble-reactions-side-top',
        bottom: 'cn-bubble-reactions-side-bottom',
      },
      align: {
        start: 'cn-bubble-reactions-align-start',
        end: 'cn-bubble-reactions-align-end',
      },
    },
    defaultVariants: {
      side: 'bottom',
      align: 'end',
    },
  },
);
function BubbleReactions(
  __props3: ComponentProps<'div'> & {
    align?: 'start' | 'end';
    side?: 'top' | 'bottom';
  },
) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={dataValue(__props3.align === undefined ? 'end' : __props3.align)}
      data-side={dataValue(__props3.side === undefined ? 'bottom' : __props3.side)}
      class={cn(
        bubbleReactionsVariants({
          get side() {
            return __props3.side === undefined ? 'bottom' : __props3.side;
          },
          get align() {
            return __props3.align === undefined ? 'end' : __props3.align;
          },
        }),
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['side', 'align', 'className'])}
    />
  );
}
export { BubbleGroup, Bubble, BubbleContent, BubbleReactions };
