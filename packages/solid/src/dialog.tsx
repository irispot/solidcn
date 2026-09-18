import { mergeRenderProps } from './utils';
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
import { Dialog as DialogPrimitive } from '@solid-cn/base-ui/dialog';
import { cn } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
function Dialog(__props0: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...omitProps(__props0, [])} />;
}
function DialogTrigger(__props1: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...omitProps(__props1, [])} />;
}
function DialogPortal(__props2: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...omitProps(__props2, [])} />;
}
function DialogClose(__props3: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...omitProps(__props3, [])} />;
}
function DialogOverlay(__props4: ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      class={cn(
        'cn-dialog-overlay fixed inset-0 isolate z-50',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function DialogContent(
  __props5: ComponentProps<typeof DialogPrimitive.Popup> & {
    showCloseButton?: boolean;
  },
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        class={cn(
          'cn-dialog-content fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none',
          __props5.className ?? __props5.class,
        )}
        {...omitProps(__props5, ['className', 'children', 'showCloseButton'])}
      >
        {__props5.children}
        {(__props5.showCloseButton === undefined ? true : __props5.showCloseButton) && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
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
                    get class() {
                      return 'cn-dialog-close';
                    },
                  },
                  {
                    get size() {
                      return 'icon-sm';
                    },
                  },
                )}
              />
            )}
          >
            <IconPlaceholder
              lucide="XIcon"
              tabler="IconX"
              hugeicons="Cancel01Icon"
              phosphor="XIcon"
              remixicon="RiCloseLine"
            />
            <span class="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}
function DialogHeader(__props6: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      class={cn('cn-dialog-header flex flex-col', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function DialogFooter(
  __props7: ComponentProps<'div'> & {
    showCloseButton?: boolean;
  },
) {
  return (
    <div
      data-slot="dialog-footer"
      class={cn(
        'cn-dialog-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        __props7.className ?? __props7.class,
      )}
      {...omitProps(__props7, ['className', 'showCloseButton', 'children'])}
    >
      {__props7.children}
      {(__props7.showCloseButton === undefined ? false : __props7.showCloseButton) && (
        <DialogPrimitive.Close
          render={(renderProps: any) => (
            <Button
              {...mergeRenderProps(renderProps, {
                get variant() {
                  return 'outline';
                },
              })}
            />
          )}
        >
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}
function DialogTitle(__props8: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      class={cn('cn-dialog-title cn-font-heading', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function DialogDescription(__props9: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      class={cn('cn-dialog-description', __props9.className ?? __props9.class)}
      {...omitProps(__props9, ['className'])}
    />
  );
}
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
