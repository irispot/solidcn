import { mergeRenderProps } from './utils';
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
import { Combobox as ComboboxPrimitive } from '@solid-cn/base-ui';
import { cn } from './utils';
import { Button } from './button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from './input-group';
import { IconPlaceholder } from './icons';
const Combobox = ComboboxPrimitive.Root;
function ComboboxValue(__props0: ComponentProps<typeof ComboboxPrimitive.Value>) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...omitProps(__props0, [])} />;
}
function ComboboxTrigger(__props1: ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      class={cn('cn-combobox-trigger', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className', 'children'])}
    >
      {__props1.children}
      <IconPlaceholder
        lucide="ChevronDownIcon"
        tabler="IconChevronDown"
        hugeicons="ArrowDown01Icon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        class="cn-combobox-trigger-icon pointer-events-none"
      />
    </ComboboxPrimitive.Trigger>
  );
}
function ComboboxClear(__props2: ComponentProps<typeof ComboboxPrimitive.Clear>) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={(renderProps: any) => (
        <InputGroupButton
          {...mergeRenderProps(
            renderProps,
            {
              get variant() {
                return 'ghost';
              },
            },
            {
              get size() {
                return 'icon-xs';
              },
            },
          )}
        />
      )}
      class={cn('cn-combobox-clear', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    >
      <IconPlaceholder
        lucide="XIcon"
        tabler="IconX"
        hugeicons="Cancel01Icon"
        phosphor="XIcon"
        remixicon="RiCloseLine"
        class="cn-combobox-clear-icon pointer-events-none"
      />
    </ComboboxPrimitive.Clear>
  );
}
function ComboboxInput(
  __props3: ComponentProps<typeof ComboboxPrimitive.Input> & {
    showTrigger?: boolean;
    showClear?: boolean;
  },
) {
  return (
    <InputGroup class={cn('cn-combobox-input w-auto', __props3.className ?? __props3.class)}>
      <ComboboxPrimitive.Input
        render={(renderProps: any) => (
          <InputGroupInput
            {...mergeRenderProps(renderProps, {
              get disabled() {
                return __props3.disabled === undefined ? false : __props3.disabled;
              },
            })}
          />
        )}
        {...omitProps(__props3, ['className', 'children', 'disabled', 'showTrigger', 'showClear'])}
      />
      <InputGroupAddon align="inline-end">
        {(__props3.showTrigger === undefined ? true : __props3.showTrigger) && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={(renderProps: any) => <ComboboxTrigger {...mergeRenderProps(renderProps)} />}
            data-slot="input-group-button"
            class="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={__props3.disabled === undefined ? false : __props3.disabled}
          />
        )}
        {(__props3.showClear === undefined ? false : __props3.showClear) && (
          <ComboboxClear disabled={__props3.disabled === undefined ? false : __props3.disabled} />
        )}
      </InputGroupAddon>
      {__props3.children}
    </InputGroup>
  );
}
function ComboboxContent(
  __props4: ComponentProps<typeof ComboboxPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof ComboboxPrimitive.Positioner>,
        'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'
      >
    >,
) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={__props4.side === undefined ? 'bottom' : __props4.side}
        sideOffset={__props4.sideOffset === undefined ? 6 : __props4.sideOffset}
        align={__props4.align === undefined ? 'start' : __props4.align}
        alignOffset={__props4.alignOffset === undefined ? 0 : __props4.alignOffset}
        anchor={__props4.anchor}
        class="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={dataValue(!!__props4.anchor)}
          class={cn(
            'cn-combobox-content cn-combobox-content-logical cn-menu-target cn-menu-translucent group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) data-[chips=true]:min-w-(--anchor-width)',
            __props4.className ?? __props4.class,
          )}
          {...omitProps(__props4, [
            'className',
            'side',
            'sideOffset',
            'align',
            'alignOffset',
            'anchor',
          ])}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}
function ComboboxList(__props5: ComponentProps<typeof ComboboxPrimitive.List>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      class={cn(
        'cn-combobox-list overflow-y-auto overscroll-contain',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function ComboboxItem(__props6: ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      class={cn(
        'cn-combobox-item relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className', 'children'])}
    >
      {__props6.children}
      <ComboboxPrimitive.ItemIndicator
        render={(renderProps: any) => (
          <span
            {...mergeRenderProps(renderProps, {
              get class() {
                return 'cn-combobox-item-indicator';
              },
            })}
          />
        )}
      >
        <IconPlaceholder
          lucide="CheckIcon"
          tabler="IconCheck"
          hugeicons="Tick02Icon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          class="cn-combobox-item-indicator-icon pointer-events-none"
        />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}
function ComboboxGroup(__props7: ComponentProps<typeof ComboboxPrimitive.Group>) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      class={cn('cn-combobox-group', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function ComboboxLabel(__props8: ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      class={cn('cn-combobox-label', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function ComboboxCollection(__props9: ComponentProps<typeof ComboboxPrimitive.Collection>) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...omitProps(__props9, [])} />
  );
}
function ComboboxEmpty(__props10: ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      class={cn('cn-combobox-empty', __props10.className ?? __props10.class)}
      {...omitProps(__props10, ['className'])}
    />
  );
}
function ComboboxSeparator(__props11: ComponentProps<typeof ComboboxPrimitive.Separator>) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      class={cn('cn-combobox-separator', __props11.className ?? __props11.class)}
      {...omitProps(__props11, ['className'])}
    />
  );
}
function ComboboxChips(
  __props12: ComponentProps<typeof ComboboxPrimitive.Chips> &
    ComponentProps<typeof ComboboxPrimitive.Chips>,
) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      class={cn('cn-combobox-chips', __props12.className ?? __props12.class)}
      {...omitProps(__props12, ['className'])}
    />
  );
}
function ComboboxChip(
  __props13: ComponentProps<typeof ComboboxPrimitive.Chip> & {
    showRemove?: boolean;
  },
) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      class={cn(
        'cn-combobox-chip has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50',
        __props13.className ?? __props13.class,
      )}
      {...omitProps(__props13, ['className', 'children', 'showRemove'])}
    >
      {__props13.children}
      {(__props13.showRemove === undefined ? true : __props13.showRemove) && (
        <ComboboxPrimitive.ChipRemove
          render={(renderProps: any) => (
            <Button
              {...mergeRenderProps(
                renderProps,
                {
                  get variant() {
                    return 'ghost';
                  },
                },
                {
                  get size() {
                    return 'icon-xs';
                  },
                },
              )}
            />
          )}
          class="cn-combobox-chip-remove"
          data-slot="combobox-chip-remove"
        >
          <IconPlaceholder
            lucide="XIcon"
            tabler="IconX"
            hugeicons="Cancel01Icon"
            phosphor="XIcon"
            remixicon="RiCloseLine"
            class="cn-combobox-chip-indicator-icon pointer-events-none"
          />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  );
}
function ComboboxChipsInput(__props14: ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      class={cn(
        'cn-combobox-chip-input min-w-16 flex-1 outline-none',
        __props14.className ?? __props14.class,
      )}
      {...omitProps(__props14, ['className'])}
    />
  );
}
function useComboboxAnchor() {
  return { current: null };
}
export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
