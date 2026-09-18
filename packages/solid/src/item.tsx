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
import { mergeProps } from '@solid-cn/base-ui/merge-props';
import { useRender } from '@solid-cn/base-ui/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { Separator } from './separator';
function ItemGroup(__props0: ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="item-group"
      class={cn(
        'cn-item-group group/item-group flex w-full flex-col',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function ItemSeparator(__props1: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      class={cn('cn-item-separator', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
const itemVariants = cva(
  'cn-item group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors',
  {
    variants: {
      variant: {
        default: 'cn-item-variant-default',
        outline: 'cn-item-variant-outline',
        muted: 'cn-item-variant-muted',
      },
      size: {
        default: 'cn-item-size-default',
        sm: 'cn-item-size-sm',
        xs: 'cn-item-size-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
function Item(__props2: ComponentProps<'div'> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: 'div',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              itemVariants({
                get variant() {
                  return __props2.variant === undefined ? 'default' : __props2.variant;
                },
                get size() {
                  return __props2.size === undefined ? 'default' : __props2.size;
                },
                get className() {
                  return __props2.className ?? __props2.class;
                },
              }),
            );
          },
        },
        omitProps(__props2, ['className', 'variant', 'size', 'render']),
      );
    },
    get render() {
      return __props2.render;
    },
    get state() {
      return {
        slot: 'item',
        get variant() {
          return __props2.variant === undefined ? 'default' : __props2.variant;
        },
        get size() {
          return __props2.size === undefined ? 'default' : __props2.size;
        },
      };
    },
  });
}
const itemMediaVariants = cva(
  'cn-item-media flex shrink-0 items-center justify-center [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'cn-item-media-variant-default',
        icon: 'cn-item-media-variant-icon',
        image: 'cn-item-media-variant-image',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
function ItemMedia(__props3: ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={dataValue(__props3.variant === undefined ? 'default' : __props3.variant)}
      class={cn(
        itemMediaVariants({
          get variant() {
            return __props3.variant === undefined ? 'default' : __props3.variant;
          },
          get className() {
            return __props3.className ?? __props3.class;
          },
        }),
      )}
      {...omitProps(__props3, ['className', 'variant'])}
    />
  );
}
function ItemContent(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      class={cn(
        'cn-item-content flex flex-1 flex-col [&+[data-slot=item-content]]:flex-none',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function ItemTitle(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      class={cn(
        'cn-item-title line-clamp-1 flex w-fit items-center',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function ItemDescription(__props6: ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      class={cn(
        'cn-item-description line-clamp-2 font-normal [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function ItemActions(__props7: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-actions"
      class={cn('cn-item-actions flex items-center', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function ItemHeader(__props8: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      class={cn(
        'cn-item-header flex basis-full items-center justify-between',
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function ItemFooter(__props9: ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      class={cn(
        'cn-item-footer flex basis-full items-center justify-between',
        __props9.className ?? __props9.class,
      )}
      {...omitProps(__props9, ['className'])}
    />
  );
}
export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
};
