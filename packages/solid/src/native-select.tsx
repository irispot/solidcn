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
import { IconPlaceholder } from './icons';
type NativeSelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};
function NativeSelect(__props0: NativeSelectProps) {
  return (
    <div
      class={cn(
        'cn-native-select-wrapper group/native-select relative w-fit has-[select:disabled]:opacity-50',
        __props0.className ?? __props0.class,
      )}
      data-slot="native-select-wrapper"
      data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
    >
      <select
        data-slot="native-select"
        data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
        class="cn-native-select outline-none disabled:pointer-events-none disabled:cursor-not-allowed"
        {...omitProps(__props0, ['className', 'size'])}
      />
      <IconPlaceholder
        lucide="ChevronDownIcon"
        tabler="IconSelector"
        hugeicons="UnfoldMoreIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        class="cn-native-select-icon pointer-events-none absolute select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}
function NativeSelectOption(__props1: ComponentProps<'option'>) {
  return (
    <option
      data-slot="native-select-option"
      class={cn('bg-[Canvas] text-[CanvasText]', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function NativeSelectOptGroup(__props2: ComponentProps<'optgroup'>) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      class={cn('bg-[Canvas] text-[CanvasText]', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
