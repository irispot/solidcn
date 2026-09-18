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
import { Separator as SeparatorPrimitive } from '@solid-cn/base-ui/separator';
import { cn } from './utils';
function Separator(__props0: ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={__props0.orientation === undefined ? 'horizontal' : __props0.orientation}
      class={cn(
        'shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'orientation'])}
    />
  );
}
export { Separator };
