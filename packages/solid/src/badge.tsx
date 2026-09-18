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
const badgeVariants = cva(
  'cn-badge group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'cn-badge-variant-default',
        secondary: 'cn-badge-variant-secondary',
        destructive: 'cn-badge-variant-destructive',
        outline: 'cn-badge-variant-outline',
        ghost: 'cn-badge-variant-ghost',
        link: 'cn-badge-variant-link',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
function Badge(__props0: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              badgeVariants({
                get variant() {
                  return __props0.variant === undefined ? 'default' : __props0.variant;
                },
              }),
              __props0.className ?? __props0.class,
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
        slot: 'badge',
        get variant() {
          return __props0.variant === undefined ? 'default' : __props0.variant;
        },
      };
    },
  });
}
export { Badge, badgeVariants };
