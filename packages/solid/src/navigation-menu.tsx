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
import { NavigationMenu as NavigationMenuPrimitive } from '@solid-cn/base-ui/navigation-menu';
import { cva } from 'class-variance-authority';
import { cn } from './utils';
import { IconPlaceholder } from './icons';
function NavigationMenu(
  __props0: ComponentProps<typeof NavigationMenuPrimitive.Root> &
    Partial<Pick<ComponentProps<typeof NavigationMenuPrimitive.Positioner>, 'align'>>,
) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      class={cn(
        'cn-navigation-menu group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['align', 'className', 'children'])}
    >
      {__props0.children}
      <NavigationMenuPositioner align={__props0.align === undefined ? 'start' : __props0.align} />
    </NavigationMenuPrimitive.Root>
  );
}
function NavigationMenuList(__props1: ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      class={cn(
        'cn-navigation-menu-list group flex flex-1 list-none items-center justify-center',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function NavigationMenuItem(__props2: ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      class={cn('cn-navigation-menu-item relative', __props2.className ?? __props2.class)}
      {...omitProps(__props2, ['className'])}
    />
  );
}
const navigationMenuTriggerStyle = cva(
  'cn-navigation-menu-trigger group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center outline-none disabled:pointer-events-none',
);
function NavigationMenuTrigger(__props3: ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      class={cn(navigationMenuTriggerStyle(), 'group', __props3.className ?? __props3.class)}
      {...omitProps(__props3, ['className', 'children'])}
    >
      {__props3.children}{' '}
      <IconPlaceholder
        lucide="ChevronDownIcon"
        tabler="IconChevronDown"
        hugeicons="ArrowDown01Icon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        class="cn-navigation-menu-trigger-icon"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}
function NavigationMenuContent(__props4: ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      class={cn(
        'cn-navigation-menu-content data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%] h-full w-auto transition-[opacity,transform,translate] duration-[0.35s] data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function NavigationMenuPositioner(
  __props5: ComponentProps<typeof NavigationMenuPrimitive.Positioner>,
) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        side={__props5.side === undefined ? 'bottom' : __props5.side}
        sideOffset={__props5.sideOffset === undefined ? 8 : __props5.sideOffset}
        align={__props5.align === undefined ? 'start' : __props5.align}
        alignOffset={__props5.alignOffset === undefined ? 0 : __props5.alignOffset}
        class={cn(
          'cn-navigation-menu-positioner isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-[0.35s] data-instant:transition-none',
          __props5.className ?? __props5.class,
        )}
        {...omitProps(__props5, ['className', 'side', 'sideOffset', 'align', 'alignOffset'])}
      >
        <NavigationMenuPrimitive.Popup class="cn-navigation-menu-popup data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)]">
          <NavigationMenuPrimitive.Viewport class="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}
function NavigationMenuLink(__props6: ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      class={cn('cn-navigation-menu-link', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function NavigationMenuIndicator(__props7: ComponentProps<typeof NavigationMenuPrimitive.Icon>) {
  return (
    <NavigationMenuPrimitive.Icon
      data-slot="navigation-menu-indicator"
      class={cn(
        'cn-navigation-menu-indicator top-full z-1 flex h-1.5 items-end justify-center overflow-hidden',
        __props7.className ?? __props7.class,
      )}
      {...omitProps(__props7, ['className'])}
    >
      <div class="cn-navigation-menu-indicator-arrow relative top-[60%] h-2 w-2 rotate-45" />
    </NavigationMenuPrimitive.Icon>
  );
}
export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuPositioner,
};
