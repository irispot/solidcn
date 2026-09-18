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
function Table(__props0: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" class="cn-table-container">
      <table
        data-slot="table"
        class={cn('cn-table', __props0.className ?? __props0.class)}
        {...omitProps(__props0, ['className'])}
      />
    </div>
  );
}
function TableHeader(__props1: ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      class={cn('cn-table-header', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function TableBody(__props2: ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      class={cn('cn-table-body', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function TableFooter(__props3: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      class={cn('cn-table-footer', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function TableRow(__props4: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      class={cn('cn-table-row has-aria-expanded:bg-muted/50', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function TableHead(__props5: ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      class={cn('cn-table-head', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function TableCell(__props6: ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      class={cn('cn-table-cell', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function TableCaption(__props7: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      class={cn('cn-table-caption', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
