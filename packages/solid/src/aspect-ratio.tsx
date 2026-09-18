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
function AspectRatio(
  __props0: ComponentProps<'div'> & {
    ratio: number;
  },
) {
  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          get '--ratio'() {
            return __props0.ratio;
          },
        } as JSX.CSSProperties
      }
      class={cn('relative aspect-(--ratio)', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['ratio', 'className'])}
    />
  );
}
export { AspectRatio };
