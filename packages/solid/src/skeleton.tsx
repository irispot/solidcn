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
function Skeleton(__props0: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      class={cn('cn-skeleton animate-pulse', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
export { Skeleton };
