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
import { Separator } from './separator';
const buttonGroupVariants = cva(
  "cn-button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          'cn-button-group-orientation-horizontal *:data-slot:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0',
        vertical:
          'cn-button-group-orientation-vertical flex-col *:data-slot:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
);
function ButtonGroup(__props0: ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={dataValue(__props0.orientation)}
      class={cn(
        buttonGroupVariants({
          get orientation() {
            return __props0.orientation;
          },
        }),
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'orientation'])}
    />
  );
}
function ButtonGroupText(__props1: ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-button-group-text flex items-center [&_svg]:pointer-events-none',
              __props1.className ?? __props1.class,
            );
          },
        },
        omitProps(__props1, ['className', 'render']),
      );
    },
    get render() {
      return __props1.render;
    },
    get state() {
      return {
        slot: 'button-group-text',
      };
    },
  });
}
function ButtonGroupSeparator(__props2: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={__props2.orientation === undefined ? 'vertical' : __props2.orientation}
      class={cn(
        'cn-button-group-separator relative self-stretch data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className', 'orientation'])}
    />
  );
}
export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
