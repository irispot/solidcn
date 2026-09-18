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
function Kbd(__props0: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      class={cn(
        'cn-kbd pointer-events-none inline-flex items-center justify-center select-none',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function KbdGroup(__props1: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd-group"
      class={cn('cn-kbd-group inline-flex items-center', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
export { Kbd, KbdGroup };
