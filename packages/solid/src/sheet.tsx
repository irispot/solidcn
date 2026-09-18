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
import { Dialog as SheetPrimitive } from '@solid-cn/base-ui/dialog';
import { cn } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
function Sheet(__props0: ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...omitProps(__props0, [])} />;
}
function SheetTrigger(__props1: ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...omitProps(__props1, [])} />;
}
function SheetClose(__props2: ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...omitProps(__props2, [])} />;
}
function SheetPortal(__props3: ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...omitProps(__props3, [])} />;
}
function SheetOverlay(__props4: ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      class={cn(
        'cn-sheet-overlay fixed inset-0 z-50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function SheetContent(
  __props5: ComponentProps<typeof SheetPrimitive.Popup> & {
    side?: 'top' | 'right' | 'bottom' | 'left';
    showCloseButton?: boolean;
  },
) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={dataValue(__props5.side === undefined ? 'right' : __props5.side)}
        class={cn(
          'cn-sheet-content data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]',
          __props5.className ?? __props5.class,
        )}
        {...omitProps(__props5, ['className', 'children', 'side', 'showCloseButton'])}
      >
        {__props5.children}
        {(__props5.showCloseButton === undefined ? true : __props5.showCloseButton) && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
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
                      return 'cn-sheet-close';
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
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}
function SheetHeader(__props6: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      class={cn('cn-sheet-header flex flex-col', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function SheetFooter(__props7: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      class={cn('cn-sheet-footer mt-auto flex flex-col', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function SheetTitle(__props8: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      class={cn('cn-sheet-title cn-font-heading', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function SheetDescription(__props9: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      class={cn('cn-sheet-description', __props9.className ?? __props9.class)}
      {...omitProps(__props9, ['className'])}
    />
  );
}
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
