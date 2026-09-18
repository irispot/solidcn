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
import { Collapsible as CollapsiblePrimitive } from '@solid-cn/base-ui/collapsible';
function Collapsible(__props0: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...omitProps(__props0, [])} />;
}
function CollapsibleTrigger(__props1: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...omitProps(__props1, [])} />
  );
}
function CollapsibleContent(__props2: ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...omitProps(__props2, [])} />
  );
}
export { Collapsible, CollapsibleTrigger, CollapsibleContent };
