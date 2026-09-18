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
import { Checkbox as CheckboxPrimitive } from '@solid-cn/base-ui/checkbox';
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function Checkbox(__props0: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      class={cn(
        'cn-checkbox peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        class="cn-checkbox-indicator grid place-content-center text-current transition-none"
      >
        <IconPlaceholder
          lucide="CheckIcon"
          tabler="IconCheck"
          hugeicons="Tick02Icon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
export { Checkbox };
