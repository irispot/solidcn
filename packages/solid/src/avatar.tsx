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
import { Avatar as AvatarPrimitive } from '@solid-cn/base-ui/avatar';
import { cn } from './utils';
function Avatar(
  __props0: ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: 'default' | 'sm' | 'lg';
  },
) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
      class={cn(
        'cn-avatar group/avatar relative flex shrink-0 select-none after:absolute after:inset-0 after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'size'])}
    />
  );
}
function AvatarImage(__props1: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      class={cn(
        'cn-avatar-image aspect-square size-full object-cover',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function AvatarFallback(__props2: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      class={cn(
        'cn-avatar-fallback flex size-full items-center justify-center text-sm group-data-[size=sm]/avatar:text-xs',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function AvatarBadge(__props3: ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      class={cn(
        'cn-avatar-badge absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function AvatarGroup(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      class={cn(
        'cn-avatar-group group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function AvatarGroupCount(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      class={cn(
        'cn-avatar-group-count relative flex shrink-0 items-center justify-center ring-2 ring-background',
        '',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
