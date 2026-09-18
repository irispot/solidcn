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
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
function Empty(__props0: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      class={cn(
        'cn-empty flex w-full min-w-0 flex-1 flex-col items-center justify-center text-center text-balance',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function EmptyHeader(__props1: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      class={cn(
        'cn-empty-header flex max-w-sm flex-col items-center',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
const emptyMediaVariants = cva(
  'cn-empty-media flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'cn-empty-media-default',
        icon: 'cn-empty-media-icon',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
function EmptyMedia(__props2: ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={dataValue(__props2.variant === undefined ? 'default' : __props2.variant)}
      class={cn(
        emptyMediaVariants({
          get variant() {
            return __props2.variant === undefined ? 'default' : __props2.variant;
          },
          get className() {
            return __props2.className ?? __props2.class;
          },
        }),
      )}
      {...omitProps(__props2, ['className', 'variant'])}
    />
  );
}
function EmptyTitle(__props3: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      class={cn('cn-empty-title cn-font-heading', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function EmptyDescription(__props4: ComponentProps<'p'>) {
  return (
    <div
      data-slot="empty-description"
      class={cn(
        'cn-empty-description text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function EmptyContent(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      class={cn(
        'cn-empty-content flex w-full max-w-sm min-w-0 flex-col items-center text-balance',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
