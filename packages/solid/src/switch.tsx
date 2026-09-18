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
import { Switch as SwitchPrimitive } from '@solid-cn/base-ui/switch';
import { cn } from './utils';
function Switch(
  __props0: ComponentProps<typeof SwitchPrimitive.Root> & {
    size?: 'sm' | 'default';
  },
) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
      class={cn(
        'cn-switch peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'size'])}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        class="cn-switch-thumb pointer-events-none block ring-0 transition-transform"
      />
    </SwitchPrimitive.Root>
  );
}
export { Switch };
