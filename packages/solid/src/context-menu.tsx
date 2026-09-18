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
import { ContextMenu as ContextMenuPrimitive } from '@solid-cn/base-ui/context-menu';
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function ContextMenu(__props0: ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...omitProps(__props0, [])} />;
}
function ContextMenuPortal(__props1: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...omitProps(__props1, [])} />
  );
}
function ContextMenuTrigger(__props2: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      class={cn('cn-context-menu-trigger select-none', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function ContextMenuContent(
  __props3: ComponentProps<typeof ContextMenuPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof ContextMenuPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
      >
    >,
) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        class="isolate z-50 outline-none"
        align={__props3.align === undefined ? 'start' : __props3.align}
        alignOffset={__props3.alignOffset === undefined ? 4 : __props3.alignOffset}
        side={__props3.side === undefined ? 'right' : __props3.side}
        sideOffset={__props3.sideOffset === undefined ? 0 : __props3.sideOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          class={cn(
            'cn-context-menu-content cn-context-menu-content-logical cn-menu-target cn-menu-translucent z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none',
            __props3.className ?? __props3.class,
          )}
          {...omitProps(__props3, ['className', 'align', 'alignOffset', 'side', 'sideOffset'])}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}
function ContextMenuGroup(__props4: ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...omitProps(__props4, [])} />;
}
function ContextMenuLabel(
  __props5: ComponentProps<typeof ContextMenuPrimitive.GroupLabel> & {
    inset?: boolean;
  },
) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={dataValue(__props5.inset)}
      class={cn('cn-context-menu-label', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className', 'inset'])}
    />
  );
}
function ContextMenuItem(
  __props6: ComponentProps<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  },
) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={dataValue(__props6.inset)}
      data-variant={dataValue(__props6.variant === undefined ? 'default' : __props6.variant)}
      class={cn(
        'cn-context-menu-item group/context-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className', 'inset', 'variant'])}
    />
  );
}
function ContextMenuSub(__props7: ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {
  return (
    <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...omitProps(__props7, [])} />
  );
}
function ContextMenuSubTrigger(
  __props8: ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger> & {
    inset?: boolean;
  },
) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={dataValue(__props8.inset)}
      class={cn(
        'cn-context-menu-sub-trigger flex cursor-default items-center outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
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
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}
function ContextMenuSubContent(__props9: ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      class="cn-context-menu-subcontent cn-menu-target cn-menu-translucent"
      side="right"
      {...omitProps(__props9, [])}
    />
  );
}
function ContextMenuCheckboxItem(
  __props10: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem> & {
    inset?: boolean;
  },
) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      data-inset={dataValue(__props10.inset)}
      class={cn(
        'cn-context-menu-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props10.className ?? __props10.class,
      )}
      checked={__props10.checked}
      {...omitProps(__props10, ['className', 'children', 'checked', 'inset'])}
    >
      <span class="cn-context-menu-item-indicator pointer-events-none">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <IconPlaceholder
            lucide="CheckIcon"
            tabler="IconCheck"
            hugeicons="Tick02Icon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
          />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {__props10.children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}
function ContextMenuRadioGroup(__props11: ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...omitProps(__props11, [])}
    />
  );
}
function ContextMenuRadioItem(
  __props12: ComponentProps<typeof ContextMenuPrimitive.RadioItem> & {
    inset?: boolean;
  },
) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      data-inset={dataValue(__props12.inset)}
      class={cn(
        'cn-context-menu-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props12.className ?? __props12.class,
      )}
      {...omitProps(__props12, ['className', 'children', 'inset'])}
    >
      <span class="cn-context-menu-item-indicator pointer-events-none">
        <ContextMenuPrimitive.RadioItemIndicator>
          <IconPlaceholder
            lucide="CheckIcon"
            tabler="IconCheck"
            hugeicons="Tick02Icon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
          />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {__props12.children}
    </ContextMenuPrimitive.RadioItem>
  );
}
function ContextMenuSeparator(__props13: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      class={cn('cn-context-menu-separator', __props13.className ?? __props13.class)}
      {...omitProps(__props13, ['className'])}
    />
  );
}
function ContextMenuShortcut(__props14: ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      class={cn('cn-context-menu-shortcut', __props14.className ?? __props14.class)}
      {...omitProps(__props14, ['className'])}
    />
  );
}
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
