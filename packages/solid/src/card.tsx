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
import { cn } from './utils';
function Card(
  __props0: ComponentProps<'div'> & {
    size?: 'default' | 'sm';
  },
) {
  return (
    <div
      data-slot="card"
      data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
      class={cn('cn-card group/card flex flex-col', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className', 'size'])}
    />
  );
}
function CardHeader(__props1: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      class={cn(
        'cn-card-header group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function CardTitle(__props2: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      class={cn('cn-card-title cn-font-heading', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function CardDescription(__props3: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      class={cn('cn-card-description', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function CardAction(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      class={cn(
        'cn-card-action col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function CardContent(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      class={cn('cn-card-content', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function CardFooter(__props6: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      class={cn('cn-card-footer flex items-center', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
