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
import { Toast as ToastPrimitive } from '@solid-cn/base-ui/toast';
import { cn } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
const toast = ToastPrimitive.createToastManager();
function ToastProvider(__props0: ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider {...omitProps(__props0, [])} />;
}
function ToastPortal(__props1: ComponentProps<typeof ToastPrimitive.Portal>) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...omitProps(__props1, [])} />;
}
function ToastViewport(__props2: ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      class={cn(
        'pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function Toast(__props3: ComponentProps<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      class={cn(
        'cn-toast group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        '[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]',
        'h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]',
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        'data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]',
        'data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]',
        '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]',
        'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        'data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function ToastContent(__props4: ComponentProps<typeof ToastPrimitive.Content>) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      class={cn(
        'flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function ToastTitle(__props5: ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      class={cn('text-sm font-medium', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function ToastDescription(__props6: ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      class={cn('text-sm text-muted-foreground', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function ToastAction(__props7: ComponentProps<typeof ToastPrimitive.Action>) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={
        __props7.render === undefined
          ? (renderProps: Record<string, any>) => (
              <Button
                {...mergeRenderProps(
                  renderProps,
                  {
                    get variant() {
                      return 'outline';
                    },
                  },
                  {
                    get size() {
                      return 'sm';
                    },
                  },
                )}
              />
            )
          : __props7.render
      }
      class={cn('shrink-0', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className', 'render'])}
    />
  );
}
function ToastClose(__props8: ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={
        __props8.render === undefined
          ? (renderProps: Record<string, any>) => (
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
                      return 'icon-sm';
                    },
                  },
                )}
              />
            )
          : __props8.render
      }
      class={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className', 'children', 'render'])}
    >
      {__props8.children ?? (
        <IconPlaceholder
          lucide="XIcon"
          tabler="IconX"
          hugeicons="Cancel01Icon"
          phosphor="XIcon"
          remixicon="RiCloseLine"
          aria-hidden="true"
        />
      )}
    </ToastPrimitive.Close>
  );
}
function ToastIcon(__props9: { type: string | undefined }) {
  const __view = createMemo(() => {
    let icon: JSX.Element = null;
    if (__props9.type === 'success') {
      icon = (
        <IconPlaceholder
          lucide="CircleCheckIcon"
          tabler="IconCircleCheck"
          hugeicons="CheckmarkCircle02Icon"
          phosphor="CheckCircleIcon"
          remixicon="RiCheckboxCircleLine"
          aria-hidden="true"
        />
      );
    }
    if (__props9.type === 'info') {
      icon = (
        <IconPlaceholder
          lucide="InfoIcon"
          tabler="IconInfoCircle"
          hugeicons="InformationCircleIcon"
          phosphor="InfoIcon"
          remixicon="RiInformationLine"
          aria-hidden="true"
        />
      );
    }
    if (__props9.type === 'warning') {
      icon = (
        <IconPlaceholder
          lucide="TriangleAlertIcon"
          tabler="IconAlertTriangle"
          hugeicons="Alert02Icon"
          phosphor="WarningIcon"
          remixicon="RiErrorWarningLine"
          aria-hidden="true"
        />
      );
    }
    if (__props9.type === 'error') {
      icon = (
        <IconPlaceholder
          lucide="OctagonXIcon"
          tabler="IconAlertOctagon"
          hugeicons="MultiplicationSignCircleIcon"
          phosphor="XCircleIcon"
          remixicon="RiCloseCircleLine"
          class="text-destructive"
          aria-hidden="true"
        />
      );
    }
    if (__props9.type === 'loading') {
      icon = (
        <IconPlaceholder
          lucide="Loader2Icon"
          tabler="IconLoader"
          hugeicons="Loading03Icon"
          phosphor="SpinnerIcon"
          remixicon="RiLoaderLine"
          class="animate-spin"
          aria-hidden="true"
        />
      );
    }
    if (!icon) {
      return null;
    }
    return (
      <span
        data-slot="toast-icon"
        class="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
      >
        {icon}
      </span>
    );
  });
  return <>{__view()}</>;
}
function ToastList() {
  const __local10 = ToastPrimitive.useToastManager();
  return (
    <>
      {__local10.toasts.map((toastItem) => (
        <Toast toast={toastItem}>
          <ToastContent>
            <ToastIcon type={toastItem.type} />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <ToastTitle />
              <ToastDescription />
            </div>
            <ToastAction />
            <ToastClose />
          </ToastContent>
        </Toast>
      ))}
    </>
  );
}
function Toaster(__props11: ComponentProps<typeof ToastPrimitive.Provider>) {
  return (
    <ToastProvider
      toastManager={__props11.toastManager === undefined ? toast : __props11.toastManager}
      {...omitProps(__props11, ['children', 'toastManager'])}
    >
      {__props11.children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}
const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;
export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
};
