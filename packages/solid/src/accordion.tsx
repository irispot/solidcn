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
import { Accordion as AccordionPrimitive } from '@solid-cn/base-ui/accordion';
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function Accordion(__props0: ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      class={cn('cn-accordion flex w-full flex-col', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function AccordionItem(__props1: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      class={cn('cn-accordion-item', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function AccordionTrigger(__props2: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header class="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        class={cn(
          'cn-accordion-trigger group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none aria-disabled:pointer-events-none aria-disabled:opacity-50',
          __props2.className ?? __props2.class,
        )}
        {...omitProps(__props2, ['className', 'children'])}
      >
        {__props2.children}
        <IconPlaceholder
          lucide="ChevronDownIcon"
          tabler="IconChevronDown"
          data-slot="accordion-trigger-icon"
          hugeicons="ArrowDown01Icon"
          phosphor="CaretDownIcon"
          remixicon="RiArrowDownSLine"
          class="cn-accordion-trigger-icon pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <IconPlaceholder
          lucide="ChevronUpIcon"
          tabler="IconChevronUp"
          data-slot="accordion-trigger-icon"
          hugeicons="ArrowUp01Icon"
          phosphor="CaretUpIcon"
          remixicon="RiArrowUpSLine"
          class="cn-accordion-trigger-icon pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}
function AccordionContent(__props3: ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      class="cn-accordion-content overflow-hidden"
      {...omitProps(__props3, ['className', 'children'])}
    >
      <div
        class={cn(
          'cn-accordion-content-inner h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
          __props3.className ?? __props3.class,
        )}
      >
        {__props3.children}
      </div>
    </AccordionPrimitive.Panel>
  );
}
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
