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
import { Command as CommandPrimitive } from './internal/command';
import { cn } from './utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { InputGroup, InputGroupAddon } from './input-group';
import { IconPlaceholder } from './icons';
function Command(__props0: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      class={cn(
        'cn-command flex size-full flex-col overflow-hidden',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function CommandDialog(
  __props1: Omit<ComponentProps<typeof Dialog>, 'children'> & {
    title?: string;
    description?: string;
    className?: string;
    showCloseButton?: boolean;
    children: JSX.Element;
  },
) {
  return (
    <Dialog
      {...omitProps(__props1, ['title', 'description', 'children', 'className', 'showCloseButton'])}
    >
      <DialogHeader class="sr-only">
        <DialogTitle>
          {__props1.title === undefined ? 'Command Palette' : __props1.title}
        </DialogTitle>
        <DialogDescription>
          {__props1.description === undefined
            ? 'Search for a command to run...'
            : __props1.description}
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        class={cn(
          'cn-command-dialog top-1/3 translate-y-0 overflow-hidden p-0',
          __props1.className ?? __props1.class,
        )}
        showCloseButton={__props1.showCloseButton === undefined ? false : __props1.showCloseButton}
      >
        {__props1.children}
      </DialogContent>
    </Dialog>
  );
}
function CommandInput(__props2: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" class="cn-command-input-wrapper">
      <InputGroup class="cn-command-input-group">
        <CommandPrimitive.Input
          data-slot="command-input"
          class={cn(
            'cn-command-input outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            __props2.className ?? __props2.class,
          )}
          {...omitProps(__props2, ['className'])}
        />
        <InputGroupAddon>
          <IconPlaceholder
            lucide="SearchIcon"
            tabler="IconSearch"
            hugeicons="SearchIcon"
            phosphor="MagnifyingGlassIcon"
            remixicon="RiSearchLine"
            class="cn-command-input-icon"
          />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
function CommandList(__props3: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      class={cn(
        'cn-command-list overflow-x-hidden overflow-y-auto',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function CommandEmpty(__props4: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      class={cn('cn-command-empty', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function CommandGroup(__props5: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      class={cn('cn-command-group', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function CommandSeparator(__props6: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      class={cn('cn-command-separator', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function CommandItem(__props7: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      class={cn(
        'cn-command-item group/command-item data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props7.className ?? __props7.class,
      )}
      {...omitProps(__props7, ['className', 'children'])}
    >
      {__props7.children}
      <IconPlaceholder
        lucide="CheckIcon"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="CheckIcon"
        remixicon="RiCheckLine"
        class="cn-command-item-indicator ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
      />
    </CommandPrimitive.Item>
  );
}
function CommandShortcut(__props8: ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      class={cn('cn-command-shortcut', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
