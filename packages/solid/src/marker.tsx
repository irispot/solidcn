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
const markerVariants = cva('cn-marker group/marker relative flex w-full items-center', {
  variants: {
    variant: {
      default: 'cn-marker-variant-default',
      separator: 'cn-marker-variant-separator',
      border: 'cn-marker-variant-border',
    },
  },
});
function Marker(__props0: ComponentProps<'div'> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: 'div',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              markerVariants({
                get variant() {
                  return __props0.variant === undefined ? 'default' : __props0.variant;
                },
                get className() {
                  return __props0.className ?? __props0.class;
                },
              }),
            );
          },
        },
        omitProps(__props0, ['className', 'variant', 'render']),
      );
    },
    get render() {
      return __props0.render;
    },
    get state() {
      return {
        slot: 'marker',
        get variant() {
          return __props0.variant === undefined ? 'default' : __props0.variant;
        },
      };
    },
  });
}
function MarkerIcon(__props1: ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      class={cn('cn-marker-icon shrink-0', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function MarkerContent(__props2: ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-content"
      class={cn('cn-marker-content min-w-0 wrap-break-word', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
export { Marker, MarkerIcon, MarkerContent, markerVariants };
