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
import { AlertDialog as AlertDialogPrimitive } from '@solid-cn/base-ui/alert-dialog';
import { cn } from './utils';
import { Button } from './button';
function AlertDialog(__props0: ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...omitProps(__props0, [])} />;
}
function AlertDialogTrigger(__props1: ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...omitProps(__props1, [])} />
  );
}
function AlertDialogPortal(__props2: ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...omitProps(__props2, [])} />
  );
}
function AlertDialogOverlay(__props3: ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      class={cn(
        'cn-alert-dialog-overlay fixed inset-0 isolate z-50',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function AlertDialogContent(
  __props4: ComponentProps<typeof AlertDialogPrimitive.Popup> & {
    size?: 'default' | 'sm';
  },
) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={dataValue(__props4.size === undefined ? 'default' : __props4.size)}
        class={cn(
          'cn-alert-dialog-content group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none',
          __props4.className ?? __props4.class,
        )}
        {...omitProps(__props4, ['className', 'size'])}
      />
    </AlertDialogPortal>
  );
}
function AlertDialogHeader(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      class={cn('cn-alert-dialog-header', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function AlertDialogFooter(__props6: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      class={cn(
        'cn-alert-dialog-footer flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function AlertDialogMedia(__props7: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-media"
      class={cn('cn-alert-dialog-media', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function AlertDialogTitle(__props8: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      class={cn('cn-alert-dialog-title cn-font-heading', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function AlertDialogDescription(__props9: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      class={cn('cn-alert-dialog-description', __props9.className ?? __props9.class)}
      {...omitProps(__props9, ['className'])}
    />
  );
}
function AlertDialogAction(__props10: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      class={cn('cn-alert-dialog-action', __props10.className ?? __props10.class)}
      {...omitProps(__props10, ['className'])}
    />
  );
}
function AlertDialogCancel(
  __props11: ComponentProps<typeof AlertDialogPrimitive.Close> &
    Partial<Pick<ComponentProps<typeof Button>, 'variant' | 'size'>>,
) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      class={cn('cn-alert-dialog-cancel', __props11.className ?? __props11.class)}
      render={(renderProps: any) => (
        <Button
          {...mergeRenderProps(
            renderProps,
            {
              get variant() {
                return __props11.variant === undefined ? 'outline' : __props11.variant;
              },
            },
            {
              get size() {
                return __props11.size === undefined ? 'default' : __props11.size;
              },
            },
          )}
        />
      )}
      {...omitProps(__props11, ['className', 'variant', 'size'])}
    />
  );
}
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
