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
import { Input as InputPrimitive } from '@solid-cn/base-ui/input';
import { cn } from './utils';
function Input(__props0: ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={__props0.type}
      data-slot="input"
      class={cn(
        'cn-input w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'type'])}
    />
  );
}
export { Input };
