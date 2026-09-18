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
import { Tabs as TabsPrimitive } from '@solid-cn/base-ui/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
function Tabs(__props0: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={dataValue(
        __props0.orientation === undefined ? 'horizontal' : __props0.orientation,
      )}
      class={cn(
        'cn-tabs group/tabs flex data-horizontal:flex-col',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'orientation'])}
    />
  );
}
const tabsListVariants = cva(
  'cn-tabs-list group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
  {
    variants: {
      variant: {
        default: 'cn-tabs-list-variant-default bg-muted',
        line: 'cn-tabs-list-variant-line gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
function TabsList(
  __props1: ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>,
) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={dataValue(__props1.variant === undefined ? 'default' : __props1.variant)}
      class={cn(
        tabsListVariants({
          get variant() {
            return __props1.variant === undefined ? 'default' : __props1.variant;
          },
        }),
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className', 'variant'])}
    />
  );
}
function TabsTrigger(__props2: ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      class={cn(
        'cn-tabs-trigger relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function TabsContent(__props3: ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      class={cn('cn-tabs-content flex-1 outline-none', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
