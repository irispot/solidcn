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
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function DropdownMenu(__props0: ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...omitProps(__props0, [])} />;
}
function DropdownMenuPortal(__props1: ComponentProps<typeof MenuPrimitive.Portal>) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...omitProps(__props1, [])} />;
}
function DropdownMenuTrigger(__props2: ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...omitProps(__props2, [])} />;
}
function DropdownMenuContent(
  __props3: ComponentProps<typeof MenuPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof MenuPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
      >
    >,
) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        class="isolate z-50 outline-none"
        align={__props3.align === undefined ? 'start' : __props3.align}
        alignOffset={__props3.alignOffset === undefined ? 0 : __props3.alignOffset}
        side={__props3.side === undefined ? 'bottom' : __props3.side}
        sideOffset={__props3.sideOffset === undefined ? 4 : __props3.sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          class={cn(
            'cn-dropdown-menu-content cn-dropdown-menu-content-logical cn-menu-target cn-menu-translucent z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden',
            __props3.className ?? __props3.class,
          )}
          {...omitProps(__props3, ['align', 'alignOffset', 'side', 'sideOffset', 'className'])}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}
function DropdownMenuGroup(__props4: ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...omitProps(__props4, [])} />;
}
function DropdownMenuLabel(
  __props5: ComponentProps<typeof MenuPrimitive.GroupLabel> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={dataValue(__props5.inset)}
      class={cn('cn-dropdown-menu-label', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className', 'inset'])}
    />
  );
}
function DropdownMenuItem(
  __props6: ComponentProps<typeof MenuPrimitive.Item> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  },
) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={dataValue(__props6.inset)}
      data-variant={dataValue(__props6.variant === undefined ? 'default' : __props6.variant)}
      class={cn(
        'cn-dropdown-menu-item group/dropdown-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className', 'inset', 'variant'])}
    />
  );
}
function DropdownMenuSub(__props7: ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...omitProps(__props7, [])} />;
}
function DropdownMenuSubTrigger(
  __props8: ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={dataValue(__props8.inset)}
      class={cn(
        'cn-dropdown-menu-sub-trigger flex cursor-default items-center outline-hidden select-none data-popup-open:bg-accent data-popup-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className', 'inset', 'children'])}
    >
      {__props8.children}
      <IconPlaceholder
        lucide="ChevronRightIcon"
        tabler="IconChevronRight"
        hugeicons="ArrowRight01Icon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        class="cn-rtl-flip ml-auto"
      />
    </MenuPrimitive.SubmenuTrigger>
  );
}
function DropdownMenuSubContent(__props9: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      class={cn(
        'cn-dropdown-menu-sub-content cn-menu-target cn-menu-translucent w-auto',
        __props9.className ?? __props9.class,
      )}
      align={__props9.align === undefined ? 'start' : __props9.align}
      alignOffset={__props9.alignOffset === undefined ? -3 : __props9.alignOffset}
      side={__props9.side === undefined ? 'right' : __props9.side}
      sideOffset={__props9.sideOffset === undefined ? 0 : __props9.sideOffset}
      {...omitProps(__props9, ['align', 'alignOffset', 'side', 'sideOffset', 'className'])}
    />
  );
}
function DropdownMenuCheckboxItem(
  __props10: ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={dataValue(__props10.inset)}
      class={cn(
        'cn-dropdown-menu-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props10.className ?? __props10.class,
      )}
      checked={__props10.checked}
      {...omitProps(__props10, ['className', 'children', 'checked', 'inset'])}
    >
      <span
        class="cn-dropdown-menu-item-indicator pointer-events-none"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
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
      {__props10.children}
    </MenuPrimitive.CheckboxItem>
  );
}
function DropdownMenuRadioGroup(__props11: ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return (
    <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...omitProps(__props11, [])} />
  );
}
function DropdownMenuRadioItem(
  __props12: ComponentProps<typeof MenuPrimitive.RadioItem> & {
    inset?: boolean;
  },
) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={dataValue(__props12.inset)}
      class={cn(
        'cn-dropdown-menu-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props12.className ?? __props12.class,
      )}
      {...omitProps(__props12, ['className', 'children', 'inset'])}
    >
      <span
        class="cn-dropdown-menu-item-indicator pointer-events-none"
        data-slot="dropdown-menu-radio-item-indicator"
      >
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
      {__props12.children}
    </MenuPrimitive.RadioItem>
  );
}
function DropdownMenuSeparator(__props13: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      class={cn('cn-dropdown-menu-separator', __props13.className ?? __props13.class)}
      {...omitProps(__props13, ['className'])}
    />
  );
}
function DropdownMenuShortcut(__props14: ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      class={cn('cn-dropdown-menu-shortcut', __props14.className ?? __props14.class)}
      {...omitProps(__props14, ['className'])}
    />
  );
}
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
