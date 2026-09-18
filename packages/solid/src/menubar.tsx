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
import { Menu as MenuPrimitive } from '@solid-cn/base-ui/menu';
import { Menubar as MenubarPrimitive } from '@solid-cn/base-ui/menubar';
import { cn } from './utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { IconPlaceholder } from './icons';
function Menubar(__props0: ComponentProps<typeof MenubarPrimitive>) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      class={cn('cn-menubar flex items-center', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function MenubarMenu(__props1: ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...omitProps(__props1, [])} />;
}
function MenubarGroup(__props2: ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...omitProps(__props2, [])} />;
}
function MenubarPortal(__props3: ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...omitProps(__props3, [])} />;
}
function MenubarTrigger(__props4: ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      class={cn(
        'cn-menubar-trigger flex items-center outline-hidden select-none',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function MenubarContent(__props5: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      align={__props5.align === undefined ? 'start' : __props5.align}
      alignOffset={__props5.alignOffset === undefined ? -4 : __props5.alignOffset}
      sideOffset={__props5.sideOffset === undefined ? 8 : __props5.sideOffset}
      class={cn(
        'cn-menubar-content cn-menubar-content-logical cn-menu-target cn-menu-translucent',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className', 'align', 'alignOffset', 'sideOffset'])}
    />
  );
}
function MenubarItem(__props6: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      data-slot="menubar-item"
      data-inset={dataValue(__props6.inset)}
      data-variant={dataValue(__props6.variant === undefined ? 'default' : __props6.variant)}
      class={cn('cn-menubar-item group/menubar-item', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className', 'inset', 'variant'])}
    />
  );
}
function MenubarCheckboxItem(
  __props7: ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      data-inset={dataValue(__props7.inset)}
      class={cn(
        'cn-menubar-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props7.className ?? __props7.class,
      )}
      checked={__props7.checked}
      {...omitProps(__props7, ['className', 'children', 'checked', 'inset'])}
    >
      <span class="cn-menubar-checkbox-item-indicator pointer-events-none absolute flex items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <IconPlaceholder
            lucide="CheckIcon"
            tabler="IconCheck"
            hugeicons="Tick02Icon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {__props7.children}
    </MenuPrimitive.CheckboxItem>
  );
}
function MenubarRadioGroup(__props8: ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...omitProps(__props8, [])} />;
}
function MenubarRadioItem(
  __props9: ComponentProps<typeof MenuPrimitive.RadioItem> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      data-inset={dataValue(__props9.inset)}
      class={cn(
        'cn-menubar-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props9.className ?? __props9.class,
      )}
      {...omitProps(__props9, ['className', 'children', 'inset'])}
    >
      <span class="cn-menubar-radio-item-indicator pointer-events-none absolute flex items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <IconPlaceholder
            lucide="CheckIcon"
            tabler="IconCheck"
            hugeicons="Tick02Icon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {__props9.children}
    </MenuPrimitive.RadioItem>
  );
}
function MenubarLabel(
  __props10: ComponentProps<typeof DropdownMenuLabel> & {
    inset?: boolean;
  },
) {
  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={dataValue(__props10.inset)}
      class={cn('cn-menubar-label', __props10.className ?? __props10.class)}
      {...omitProps(__props10, ['className', 'inset'])}
    />
  );
}
function MenubarSeparator(__props11: ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      class={cn('cn-menubar-separator -mx-1 my-1 h-px', __props11.className ?? __props11.class)}
      {...omitProps(__props11, ['className'])}
    />
  );
}
function MenubarShortcut(__props12: ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      data-slot="menubar-shortcut"
      class={cn('cn-menubar-shortcut ml-auto', __props12.className ?? __props12.class)}
      {...omitProps(__props12, ['className'])}
    />
  );
}
function MenubarSub(__props13: ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...omitProps(__props13, [])} />;
}
function MenubarSubTrigger(
  __props14: ComponentProps<typeof DropdownMenuSubTrigger> & {
    inset?: boolean;
  },
) {
  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={dataValue(__props14.inset)}
      class={cn('cn-menubar-sub-trigger', __props14.className ?? __props14.class)}
      {...omitProps(__props14, ['className', 'inset'])}
    />
  );
}
function MenubarSubContent(__props15: ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      data-slot="menubar-sub-content"
      class={cn(
        'cn-menubar-sub-content cn-menu-target cn-menu-translucent',
        __props15.className ?? __props15.class,
      )}
      {...omitProps(__props15, ['className'])}
    />
  );
}
export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
