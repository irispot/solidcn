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
import { Button as ButtonPrimitive } from '@solid-cn/base-ui/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
const buttonVariants = cva(
  'cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'cn-button-variant-default',
        outline: 'cn-button-variant-outline',
        secondary: 'cn-button-variant-secondary',
        ghost: 'cn-button-variant-ghost',
        destructive: 'cn-button-variant-destructive',
        link: 'cn-button-variant-link',
      },
      size: {
        default: 'cn-button-size-default',
        xs: 'cn-button-size-xs',
        sm: 'cn-button-size-sm',
        lg: 'cn-button-size-lg',
        icon: 'cn-button-size-icon',
        'icon-xs': 'cn-button-size-icon-xs',
        'icon-sm': 'cn-button-size-icon-sm',
        'icon-lg': 'cn-button-size-icon-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
function Button(
  __props0: ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>,
) {
  return (
    <ButtonPrimitive
      data-slot="button"
      class={cn(
        buttonVariants({
          get variant() {
            return __props0.variant === undefined ? 'default' : __props0.variant;
          },
          get size() {
            return __props0.size === undefined ? 'default' : __props0.size;
          },
          get className() {
            return __props0.className ?? __props0.class;
          },
        }),
      )}
      {...omitProps(__props0, ['className', 'variant', 'size'])}
    />
  );
}
export { Button, buttonVariants };
