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
import { mergeProps } from '@solid-cn/base-ui/merge-props';
import { useRender } from '@solid-cn/base-ui/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { useIsMobile } from './use-mobile';
import { Button } from './button';
import { Input } from './input';
import { Separator } from './separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './sheet';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { IconPlaceholder } from './icons';
const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};
const SidebarContext = createContext<SidebarContextProps | null>(null);
function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
}
function SidebarProvider(
  __props0: ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  },
) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = createSignal(false);
  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = createSignal(
    __props0.defaultOpen === undefined ? true : __props0.defaultOpen,
  );
  const open = () => __props0.open ?? _open();
  const setOpen = (value: boolean | ((value: boolean) => boolean)) => {
    const openState = typeof value === 'function' ? value(open()) : value;
    if (__props0.onOpenChange) {
      __props0.onOpenChange(openState);
    } else {
      _setOpen(openState);
    }
    // This sets the cookie to keep the sidebar state.
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  };
  // Helper to toggle the sidebar.
  const toggleSidebar = () => {
    return isMobile() ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  };
  // Adds a keyboard shortcut to toggle the sidebar.
  createEffect(
    () => [toggleSidebar],
    () => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    },
  );
  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = () => (open() ? 'expanded' : 'collapsed');
  const contextValue = createMemo<SidebarContextProps>(() => ({
    get state() {
      return state();
    },
    get open() {
      return open();
    },
    setOpen,
    get isMobile() {
      return isMobile();
    },
    get openMobile() {
      return openMobile();
    },
    setOpenMobile,
    toggleSidebar,
  }));
  return (
    <SidebarContext value={contextValue()}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            get '--sidebar-width'() {
              return SIDEBAR_WIDTH;
            },
            get '--sidebar-width-icon'() {
              return SIDEBAR_WIDTH_ICON;
            },
            ...(typeof __props0.style === 'object' ? __props0.style : {}),
          } as JSX.CSSProperties
        }
        class={cn(
          'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
          __props0.className ?? __props0.class,
        )}
        {...omitProps(__props0, [
          'defaultOpen',
          'open',
          'onOpenChange',
          'className',
          'style',
          'children',
        ])}
      >
        {__props0.children}
      </div>
    </SidebarContext>
  );
}
function Sidebar(
  __props1: ComponentProps<'div'> & {
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset';
    collapsible?: 'offcanvas' | 'icon' | 'none';
  },
) {
  const __local2 = useSidebar();
  const __view = createMemo(() => {
    if ((__props1.collapsible === undefined ? 'offcanvas' : __props1.collapsible) === 'none') {
      return (
        <div
          data-slot="sidebar"
          class={cn(
            'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
            __props1.className ?? __props1.class,
          )}
          {...omitProps(__props1, [
            'side',
            'variant',
            'collapsible',
            'className',
            'children',
            'dir',
          ])}
        >
          {__props1.children}
        </div>
      );
    }
    if (__local2.isMobile) {
      return (
        <Sheet
          open={__local2.openMobile}
          onOpenChange={__local2.setOpenMobile}
          {...omitProps(__props1, [
            'side',
            'variant',
            'collapsible',
            'className',
            'children',
            'dir',
          ])}
        >
          <SheetContent
            dir={__props1.dir}
            data-sidebar="sidebar"
            data-slot="sidebar"
            data-mobile="true"
            class="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                get '--sidebar-width'() {
                  return SIDEBAR_WIDTH_MOBILE;
                },
              } as JSX.CSSProperties
            }
            side={__props1.side === undefined ? 'left' : __props1.side}
          >
            <SheetHeader class="sr-only">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <div class="flex h-full w-full flex-col">{__props1.children}</div>
          </SheetContent>
        </Sheet>
      );
    }
    return (
      <div
        class="group peer hidden text-sidebar-foreground md:block"
        data-state={dataValue(__local2.state)}
        data-collapsible={dataValue(
          __local2.state === 'collapsed'
            ? __props1.collapsible === undefined
              ? 'offcanvas'
              : __props1.collapsible
            : '',
        )}
        data-variant={dataValue(__props1.variant === undefined ? 'sidebar' : __props1.variant)}
        data-side={dataValue(__props1.side === undefined ? 'left' : __props1.side)}
        data-slot="sidebar"
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          data-slot="sidebar-gap"
          class={cn(
            'cn-sidebar-gap relative w-(--sidebar-width) bg-transparent',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            (__props1.variant === undefined ? 'sidebar' : __props1.variant) === 'floating' ||
              (__props1.variant === undefined ? 'sidebar' : __props1.variant) === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
              : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
          )}
        />
        <div
          data-slot="sidebar-container"
          data-side={dataValue(__props1.side === undefined ? 'left' : __props1.side)}
          class={cn(
            'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex',
            // Adjust the padding for floating and inset variants.
            (__props1.variant === undefined ? 'sidebar' : __props1.variant) === 'floating' ||
              (__props1.variant === undefined ? 'sidebar' : __props1.variant) === 'inset'
              ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
              : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
            __props1.className ?? __props1.class,
          )}
          {...omitProps(__props1, [
            'side',
            'variant',
            'collapsible',
            'className',
            'children',
            'dir',
          ])}
        >
          <div
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
            class="cn-sidebar-inner flex size-full flex-col"
          >
            {__props1.children}
          </div>
        </div>
      </div>
    );
  });
  return <>{__view()}</>;
}
function SidebarTrigger(__props3: ComponentProps<typeof Button>) {
  const __local4 = useSidebar();
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      class={cn('cn-sidebar-trigger', __props3.className ?? __props3.class)}
      onClick={(event: MouseEvent) => {
        __props3.onClick?.(event);
        __local4.toggleSidebar();
      }}
      {...omitProps(__props3, ['className', 'onClick'])}
    >
      <IconPlaceholder
        lucide="PanelLeftIcon"
        tabler="IconLayoutSidebar"
        hugeicons="SidebarLeftIcon"
        phosphor="SidebarIcon"
        remixicon="RiSideBarLine"
        class="cn-rtl-flip"
      />
      <span class="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
function SidebarRail(__props5: ComponentProps<'button'>) {
  const __local6 = useSidebar();
  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabindex={-1}
      onClick={__local6.toggleSidebar}
      title="Toggle Sidebar"
      class={cn(
        'cn-sidebar-rail absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function SidebarInset(__props7: ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      class={cn(
        'cn-sidebar-inset relative flex w-full flex-1 flex-col',
        __props7.className ?? __props7.class,
      )}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function SidebarInput(__props8: ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      class={cn('cn-sidebar-input', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['className'])}
    />
  );
}
function SidebarHeader(__props9: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      class={cn('cn-sidebar-header flex flex-col', __props9.className ?? __props9.class)}
      {...omitProps(__props9, ['className'])}
    />
  );
}
function SidebarFooter(__props10: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      class={cn('cn-sidebar-footer flex flex-col', __props10.className ?? __props10.class)}
      {...omitProps(__props10, ['className'])}
    />
  );
}
function SidebarSeparator(__props11: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      class={cn('cn-sidebar-separator w-auto', __props11.className ?? __props11.class)}
      {...omitProps(__props11, ['className'])}
    />
  );
}
function SidebarContent(__props12: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      class={cn(
        'cn-sidebar-content flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        __props12.className ?? __props12.class,
      )}
      {...omitProps(__props12, ['className'])}
    />
  );
}
function SidebarGroup(__props13: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      class={cn(
        'cn-sidebar-group relative flex w-full min-w-0 flex-col',
        __props13.className ?? __props13.class,
      )}
      {...omitProps(__props13, ['className'])}
    />
  );
}
function SidebarGroupLabel(__props14: ComponentProps<'div'> & ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-sidebar-group-label flex shrink-0 items-center outline-hidden [&>svg]:shrink-0',
              __props14.className ?? __props14.class,
            );
          },
        },
        omitProps(__props14, ['className', 'render']),
      );
    },
    get render() {
      return __props14.render;
    },
    get state() {
      return {
        slot: 'sidebar-group-label',
        sidebar: 'group-label',
      };
    },
  });
}
function SidebarGroupAction(__props15: ComponentProps<'button'> & ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-sidebar-group-action flex aspect-square items-center justify-center outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 md:after:hidden [&>svg]:shrink-0',
              __props15.className ?? __props15.class,
            );
          },
        },
        omitProps(__props15, ['className', 'render']),
      );
    },
    get render() {
      return __props15.render;
    },
    get state() {
      return {
        slot: 'sidebar-group-action',
        sidebar: 'group-action',
      };
    },
  });
}
function SidebarGroupContent(__props16: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      class={cn('cn-sidebar-group-content w-full', __props16.className ?? __props16.class)}
      {...omitProps(__props16, ['className'])}
    />
  );
}
function SidebarMenu(__props17: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      class={cn(
        'cn-sidebar-menu flex w-full min-w-0 flex-col',
        __props17.className ?? __props17.class,
      )}
      {...omitProps(__props17, ['className'])}
    />
  );
}
function SidebarMenuItem(__props18: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      class={cn('group/menu-item relative', __props18.className ?? __props18.class)}
      {...omitProps(__props18, ['className'])}
    />
  );
}
const sidebarMenuButtonVariants = cva(
  'cn-sidebar-menu-button peer/menu-button group/menu-button flex w-full items-center overflow-hidden outline-hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
  {
    variants: {
      variant: {
        default: 'cn-sidebar-menu-button-variant-default',
        outline: 'cn-sidebar-menu-button-variant-outline',
      },
      size: {
        default: 'cn-sidebar-menu-button-size-default',
        sm: 'cn-sidebar-menu-button-size-sm',
        lg: 'cn-sidebar-menu-button-size-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
function SidebarMenuButton(
  __props19: ComponentProps<'button'> &
    ComponentProps<'button'> & {
      isActive?: boolean;
      tooltip?: string | ComponentProps<typeof TooltipContent>;
    } & VariantProps<typeof sidebarMenuButtonVariants>,
) {
  const __local20 = useSidebar();
  const comp = useRender({
    defaultTagName: 'button',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              sidebarMenuButtonVariants({
                get variant() {
                  return __props19.variant === undefined ? 'default' : __props19.variant;
                },
                get size() {
                  return __props19.size === undefined ? 'default' : __props19.size;
                },
              }),
              __props19.className ?? __props19.class,
            );
          },
        },
        omitProps(__props19, ['render', 'isActive', 'variant', 'size', 'tooltip', 'className']),
      );
    },
    get render() {
      return !__props19.tooltip
        ? __props19.render
        : (renderProps: Record<string, any>) => (
            <TooltipTrigger {...renderProps} render={__props19.render} />
          );
    },
    get state() {
      return {
        slot: 'sidebar-menu-button',
        sidebar: 'menu-button',
        get size() {
          return __props19.size === undefined ? 'default' : __props19.size;
        },
        get active() {
          return __props19.isActive === undefined ? false : __props19.isActive;
        },
      };
    },
  });
  if (!__props19.tooltip) {
    return comp;
  }
  const tooltipProps = () =>
    typeof __props19.tooltip === 'string'
      ? { children: __props19.tooltip }
      : (__props19.tooltip ?? {});
  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={__local20.state !== 'collapsed' || __local20.isMobile}
        {...tooltipProps()}
      />
    </Tooltip>
  );
}
function SidebarMenuAction(
  __props21: ComponentProps<'button'> &
    ComponentProps<'button'> & {
      showOnHover?: boolean;
    },
) {
  return useRender({
    defaultTagName: 'button',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-sidebar-menu-action flex items-center justify-center outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 md:after:hidden [&>svg]:shrink-0',
              (__props21.showOnHover === undefined ? false : __props21.showOnHover) &&
                'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0',
              __props21.className ?? __props21.class,
            );
          },
        },
        omitProps(__props21, ['className', 'render', 'showOnHover']),
      );
    },
    get render() {
      return __props21.render;
    },
    get state() {
      return {
        slot: 'sidebar-menu-action',
        sidebar: 'menu-action',
      };
    },
  });
}
function SidebarMenuBadge(__props22: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      class={cn(
        'cn-sidebar-menu-badge flex items-center justify-center tabular-nums select-none group-data-[collapsible=icon]:hidden',
        __props22.className ?? __props22.class,
      )}
      {...omitProps(__props22, ['className'])}
    />
  );
}
function SidebarMenuSkeleton(
  __props23: ComponentProps<'div'> & {
    showIcon?: boolean;
  },
) {
  // Random width between 50 to 90%.
  const [width] = createSignal(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  });
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      class={cn(
        'cn-sidebar-menu-skeleton flex items-center',
        __props23.className ?? __props23.class,
      )}
      {...omitProps(__props23, ['className', 'showIcon'])}
    >
      {(__props23.showIcon === undefined ? false : __props23.showIcon) && (
        <Skeleton class="cn-sidebar-menu-skeleton-icon" data-sidebar="menu-skeleton-icon" />
      )}
      <Skeleton
        class="cn-sidebar-menu-skeleton-text max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            get '--skeleton-width'() {
              return width();
            },
          } as JSX.CSSProperties
        }
      />
    </div>
  );
}
function SidebarMenuSub(__props24: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      class={cn(
        'cn-sidebar-menu-sub flex min-w-0 flex-col',
        __props24.className ?? __props24.class,
      )}
      {...omitProps(__props24, ['className'])}
    />
  );
}
function SidebarMenuSubItem(__props25: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      class={cn('group/menu-sub-item relative', __props25.className ?? __props25.class)}
      {...omitProps(__props25, ['className'])}
    />
  );
}
function SidebarMenuSubButton(
  __props26: ComponentProps<'a'> &
    ComponentProps<'a'> & {
      size?: 'sm' | 'md';
      isActive?: boolean;
    },
) {
  return useRender({
    defaultTagName: 'a',
    get props() {
      return mergeProps(
        {
          get className() {
            return cn(
              'cn-sidebar-menu-sub-button flex min-w-0 -translate-x-px items-center overflow-hidden outline-hidden group-data-[collapsible=icon]:hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:shrink-0',
              __props26.className ?? __props26.class,
            );
          },
        },
        omitProps(__props26, ['render', 'size', 'isActive', 'className']),
      );
    },
    get render() {
      return __props26.render;
    },
    get state() {
      return {
        slot: 'sidebar-menu-sub-button',
        sidebar: 'menu-sub-button',
        get size() {
          return __props26.size === undefined ? 'md' : __props26.size;
        },
        get active() {
          return __props26.isActive === undefined ? false : __props26.isActive;
        },
      };
    },
  });
}
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
