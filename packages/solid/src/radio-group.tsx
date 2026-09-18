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
import { Radio as RadioPrimitive } from '@solid-cn/base-ui/radio';
import { RadioGroup as RadioGroupPrimitive } from '@solid-cn/base-ui/radio-group';
import { cn } from './utils';
function RadioGroup(__props0: ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      class={cn('cn-radio-group w-full', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function RadioGroupItem(__props1: ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      class={cn(
        'cn-radio-group-item group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    >
      <RadioPrimitive.Indicator data-slot="radio-group-indicator" class="cn-radio-group-indicator">
        <span class="cn-radio-group-indicator-icon" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}
export { RadioGroup, RadioGroupItem };
