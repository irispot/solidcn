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
import { Toggle as TogglePrimitive } from '@solid-cn/base-ui/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
const toggleVariants = cva(
  'cn-toggle group/toggle inline-flex items-center justify-center whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'cn-toggle-variant-default',
        outline: 'cn-toggle-variant-outline',
      },
      size: {
        default: 'cn-toggle-size-default',
        sm: 'cn-toggle-size-sm',
        lg: 'cn-toggle-size-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
function Toggle(
  __props0: ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>,
) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      class={cn(
        toggleVariants({
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
export { Toggle, toggleVariants };
