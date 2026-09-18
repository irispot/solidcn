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
import { Select as SelectPrimitive } from '@solid-cn/base-ui/select';
import { cn } from './utils';
import { IconPlaceholder } from './icons';
const Select = SelectPrimitive.Root;
function SelectGroup(__props0: ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      class={cn('cn-select-group', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function SelectValue(__props1: ComponentProps<typeof SelectPrimitive.Value>) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      class={cn('cn-select-value', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function SelectTrigger(
  __props2: ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: 'sm' | 'default';
  },
) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={dataValue(__props2.size === undefined ? 'default' : __props2.size)}
      class={cn(
        'cn-select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className', 'size', 'children'])}
    >
      {__props2.children}
      <SelectPrimitive.Icon
        render={(renderProps: any) => (
          <IconPlaceholder
            {...mergeRenderProps(
              renderProps,
              {
                get lucide() {
                  return 'ChevronDownIcon';
                },
              },
              {
                get tabler() {
                  return 'IconSelector';
                },
              },
              {
                get hugeicons() {
                  return 'UnfoldMoreIcon';
                },
              },
              {
                get phosphor() {
                  return 'CaretDownIcon';
                },
              },
              {
                get remixicon() {
                  return 'RiArrowDownSLine';
                },
              },
              {
                get class() {
                  return 'cn-select-trigger-icon pointer-events-none';
                },
              },
            )}
          />
        )}
      />
    </SelectPrimitive.Trigger>
  );
}
function SelectContent(
  __props3: ComponentProps<typeof SelectPrimitive.Popup> &
    Partial<
      Pick<
        ComponentProps<typeof SelectPrimitive.Positioner>,
        'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
      >
    >,
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={__props3.side === undefined ? 'bottom' : __props3.side}
        sideOffset={__props3.sideOffset === undefined ? 4 : __props3.sideOffset}
        align={__props3.align === undefined ? 'center' : __props3.align}
        alignOffset={__props3.alignOffset === undefined ? 0 : __props3.alignOffset}
        alignItemWithTrigger={
          __props3.alignItemWithTrigger === undefined ? true : __props3.alignItemWithTrigger
        }
        class="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={dataValue(
            __props3.alignItemWithTrigger === undefined ? true : __props3.alignItemWithTrigger,
          )}
          class={cn(
            'cn-select-content cn-select-content-logical cn-menu-target cn-menu-translucent relative isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto data-[align-trigger=true]:animate-none',
            __props3.className ?? __props3.class,
          )}
          {...omitProps(__props3, [
            'className',
            'children',
            'side',
            'sideOffset',
            'align',
            'alignOffset',
            'alignItemWithTrigger',
          ])}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{__props3.children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}
function SelectLabel(__props4: ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      class={cn('cn-select-label', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function SelectItem(__props5: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      class={cn(
        'cn-select-item relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className', 'children'])}
    >
      <SelectPrimitive.ItemText class="cn-select-item-text shrink-0 whitespace-nowrap">
        {__props5.children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={(renderProps: any) => (
          <span
            {...mergeRenderProps(renderProps, {
              get class() {
                return 'cn-select-item-indicator';
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
          class="cn-select-item-indicator-icon pointer-events-none"
        />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
function SelectSeparator(__props6: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      class={cn('cn-select-separator pointer-events-none', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function SelectScrollUpButton(__props7: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      class={cn('cn-select-scroll-up-button top-0 w-full', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    >
      <IconPlaceholder
        lucide="ChevronUpIcon"
        tabler="IconChevronUp"
        hugeicons="ArrowUp01Icon"
        phosphor="CaretUpIcon"
        remixicon="RiArrowUpSLine"
      />
    </SelectPrimitive.ScrollUpArrow>
  );
}
function SelectScrollDownButton(__props8: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      class={cn(
        'cn-select-scroll-down-button bottom-0 w-full',
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className'])}
    >
      <IconPlaceholder
        lucide="ChevronDownIcon"
        tabler="IconChevronDown"
        hugeicons="ArrowDown01Icon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
      />
    </SelectPrimitive.ScrollDownArrow>
  );
}
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
