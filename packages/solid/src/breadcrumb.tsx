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
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function Breadcrumb(__props0: ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      class={cn('cn-breadcrumb', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function BreadcrumbList(__props1: ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      class={cn(
        'cn-breadcrumb-list flex flex-wrap items-center wrap-break-word',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function BreadcrumbItem(__props2: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      class={cn(
        'cn-breadcrumb-item inline-flex items-center',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function BreadcrumbLink(__props3: ComponentProps<'a'>) {
  return useRender({
    defaultTagName: 'a',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn('cn-breadcrumb-link', __props3.className ?? __props3.class);
          },
        },
        omitProps(__props3, ['className', 'render']),
      );
    },
    get render() {
      return __props3.render;
    },
    get state() {
      return {
        slot: 'breadcrumb-link',
      };
    },
  });
}
function BreadcrumbPage(__props4: ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      class={cn('cn-breadcrumb-page', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function BreadcrumbSeparator(__props5: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class={cn('cn-breadcrumb-separator', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['children', 'className'])}
    >
      {__props5.children ?? (
        <IconPlaceholder
          lucide="ChevronRightIcon"
          tabler="IconChevronRight"
          hugeicons="ArrowRight01Icon"
          phosphor="CaretRightIcon"
          remixicon="RiArrowRightSLine"
          class="cn-rtl-flip"
        />
      )}
    </li>
  );
}
function BreadcrumbEllipsis(__props6: ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      class={cn(
        'cn-breadcrumb-ellipsis flex items-center justify-center',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className'])}
    >
      <IconPlaceholder
        lucide="MoreHorizontalIcon"
        tabler="IconDots"
        hugeicons="MoreHorizontalCircle01Icon"
        phosphor="DotsThreeIcon"
        remixicon="RiMoreLine"
      />
      <span class="sr-only">More</span>
    </span>
  );
}
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
