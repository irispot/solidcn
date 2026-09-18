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
import { Drawer as DrawerPrimitive } from '@solid-cn/base-ui/drawer';
import { cn } from './utils';
type DrawerContextProps = {
  hasSnapPoints: boolean;
  modal: ComponentProps<typeof DrawerPrimitive.Root>['modal'];
  showSwipeHandle: boolean;
  swipeDirection: NonNullable<ComponentProps<typeof DrawerPrimitive.Root>['swipeDirection']>;
};
const DrawerContext = createContext<DrawerContextProps | null>(null);
function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a Drawer.');
  }
  return context;
}
function Drawer(
  __props0: ComponentProps<typeof DrawerPrimitive.Root> & {
    showSwipeHandle?: boolean;
  },
) {
  const hasSnapPoints = () => __props0.snapPoints != null && __props0.snapPoints.length > 0;
  const contextValue = createMemo(() => ({
    get hasSnapPoints() {
      return hasSnapPoints();
    },
    get modal() {
      return __props0.modal === undefined ? true : __props0.modal;
    },
    get showSwipeHandle() {
      return __props0.showSwipeHandle === undefined ? false : __props0.showSwipeHandle;
    },
    get swipeDirection() {
      return __props0.swipeDirection === undefined ? 'down' : __props0.swipeDirection;
    },
  }));
  return (
    <DrawerContext value={contextValue()}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={__props0.modal === undefined ? true : __props0.modal}
        snapPoints={__props0.snapPoints}
        swipeDirection={__props0.swipeDirection === undefined ? 'down' : __props0.swipeDirection}
        {...omitProps(__props0, ['modal', 'showSwipeHandle', 'snapPoints', 'swipeDirection'])}
      />
    </DrawerContext>
  );
}
function DrawerTrigger(__props1: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...omitProps(__props1, [])} />;
}
function DrawerPortal(__props2: ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...omitProps(__props2, [])} />;
}
function DrawerClose(__props3: ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...omitProps(__props3, [])} />;
}
function DrawerOverlay(__props4: ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      class={cn(
        'cn-drawer-overlay fixed inset-0 z-50 min-h-dvh opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-snap-points:[--drawer-overlay-min-opacity:0.5] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function DrawerSwipeHandle(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      class={cn(
        'cn-drawer-swipe-handle relative z-10 flex shrink-0 cursor-grab transition-opacity duration-200 group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-[swipe-direction=left]/drawer-popup:order-last group-data-[swipe-direction=up]/drawer-popup:order-last active:cursor-grabbing',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function DrawerContent(__props6: ComponentProps<typeof DrawerPrimitive.Popup>) {
  const __local7 = useDrawer();
  const swipeAxis = () =>
    __local7.swipeDirection === 'down' || __local7.swipeDirection === 'up' ? 'y' : 'x';
  return (
    <DrawerPortal data-slot="drawer-portal">
      {__local7.modal === true && (
        <DrawerOverlay data-snap-points={dataValue(__local7.hasSnapPoints ? '' : undefined)} />
      )}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={dataValue(__local7.modal)}
        class="pointer-events-none fixed inset-0 z-50 select-none data-[modal=true]:pointer-events-auto"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={dataValue(swipeAxis())}
          data-snap-points={dataValue(__local7.hasSnapPoints ? '' : undefined)}
          class={cn(
            // Base.
            'cn-drawer-popup group/drawer-popup pointer-events-auto fixed z-50 m-(--drawer-inset,0px) flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col transition-[transform,height,opacity,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform outline-none select-none [interpolate-size:allow-keywords]',
            // Nested.
            'data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95',
            // Bleed.
            'after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=x]:after:inset-y-0 data-[swipe-axis=x]:after:w-(--bleed) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=right]:after:left-full data-[swipe-direction=up]:after:bottom-full',
            // Sizing.
            '[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100dvh] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]',
            // Stack.
            '[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]',
            // Transitions.
            'data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
            // Axis: y.
            'data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)',
            // Axis: x.
            'data-[swipe-axis=x]:inset-y-0 data-[swipe-axis=x]:flex-row',
            // Direction: down.
            'data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: up.
            'data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: left.
            'data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]',
            // Direction: right.
            'data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]',
            __props6.className ?? __props6.class,
          )}
          {...omitProps(__props6, ['className', 'children'])}
        >
          {__local7.showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            class={cn(
              'cn-drawer-content-base flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none',
            )}
          >
            {__props6.children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}
function DrawerHeader(__props8: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      class={cn(
        'cn-drawer-header-base flex shrink-0 flex-col group-data-[swipe-axis=y]/drawer-popup:text-center',
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function DrawerFooter(__props9: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      class={cn(
        'cn-drawer-footer-base mt-auto flex shrink-0 flex-col',
        __props9.className ?? __props9.class,
      )}
      {...omitProps(__props9, ['className'])}
    />
  );
}
function DrawerTitle(__props10: ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      class={cn('cn-drawer-title cn-font-heading', __props10.className ?? __props10.class)}
      {...omitProps(__props10, ['className'])}
    />
  );
}
function DrawerDescription(__props11: ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      class={cn('cn-drawer-description text-balance', __props11.className ?? __props11.class)}
      {...omitProps(__props11, ['className'])}
    />
  );
}
export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
