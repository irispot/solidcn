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
function Spinner(__props0: ComponentProps<'svg'>) {
  return (
    <IconPlaceholder
      lucide="Loader2Icon"
      tabler="IconLoader"
      hugeicons="Loading03Icon"
      phosphor="SpinnerIcon"
      remixicon="RiLoaderLine"
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      class={cn('size-4 animate-spin', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
export { Spinner };
