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
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
const alertVariants = cva('cn-alert group/alert relative w-full', {
  variants: {
    variant: {
      default: 'cn-alert-variant-default',
      destructive: 'cn-alert-variant-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
function Alert(__props0: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      class={cn(
        alertVariants({
          get variant() {
            return __props0.variant;
          },
        }),
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'variant'])}
    />
  );
}
function AlertTitle(__props1: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      class={cn(
        'cn-alert-title [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function AlertDescription(__props2: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      class={cn(
        'cn-alert-description [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function AlertAction(__props3: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      class={cn('cn-alert-action', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
export { Alert, AlertTitle, AlertDescription, AlertAction };
