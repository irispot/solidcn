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
import { cn } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
function Pagination(__props0: ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      class={cn(
        'cn-pagination mx-auto flex w-full justify-center',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function PaginationContent(__props1: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      class={cn('cn-pagination-content flex items-center', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function PaginationItem(__props2: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...omitProps(__props2, [])} />;
}
type PaginationLinkProps = {
  isActive?: boolean;
} & Partial<Pick<ComponentProps<typeof Button>, 'size'>> &
  ComponentProps<'a'>;
function PaginationLink(__props3: PaginationLinkProps) {
  return (
    <Button
      variant={__props3.isActive ? 'outline' : 'ghost'}
      size={__props3.size === undefined ? 'icon' : __props3.size}
      class={cn('cn-pagination-link', __props3.className ?? __props3.class)}
      nativeButton={false}
      render={(renderProps: any) => (
        <a
          {...mergeRenderProps(
            renderProps,
            {
              get 'aria-current'() {
                return __props3.isActive ? 'page' : undefined;
              },
            },
            {
              get 'data-slot'() {
                return 'pagination-link';
              },
            },
            {
              get 'data-active'() {
                return dataValue(__props3.isActive);
              },
            },
            omitProps(__props3, ['className', 'isActive', 'size']),
          )}
        />
      )}
    />
  );
}
function PaginationPrevious(
  __props4: ComponentProps<typeof PaginationLink> & {
    text?: string;
  },
) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      class={cn('cn-pagination-previous', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className', 'text'])}
    >
      <IconPlaceholder
        lucide="ChevronLeftIcon"
        tabler="IconChevronLeft"
        hugeicons="ArrowLeft01Icon"
        phosphor="CaretLeftIcon"
        remixicon="RiArrowLeftSLine"
        data-icon="inline-start"
        class="cn-rtl-flip"
      />
      <span class="cn-pagination-previous-text hidden sm:block">
        {__props4.text === undefined ? 'Previous' : __props4.text}
      </span>
    </PaginationLink>
  );
}
function PaginationNext(
  __props5: ComponentProps<typeof PaginationLink> & {
    text?: string;
  },
) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      class={cn('cn-pagination-next', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className', 'text'])}
    >
      <span class="cn-pagination-next-text hidden sm:block">
        {__props5.text === undefined ? 'Next' : __props5.text}
      </span>
      <IconPlaceholder
        lucide="ChevronRightIcon"
        tabler="IconChevronRight"
        hugeicons="ArrowRight01Icon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        data-icon="inline-end"
        class="cn-rtl-flip"
      />
    </PaginationLink>
  );
}
function PaginationEllipsis(__props6: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      class={cn(
        'cn-pagination-ellipsis flex items-center justify-center',
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
      <span class="sr-only">More pages</span>
    </span>
  );
}
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
