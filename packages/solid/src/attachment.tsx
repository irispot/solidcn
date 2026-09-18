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
import { Button } from './button';
const attachmentVariants = cva(
  'cn-attachment group/attachment relative flex max-w-full min-w-0 shrink-0 flex-wrap border bg-card text-card-foreground transition-colors has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed',
  {
    variants: {
      size: {
        default: 'cn-attachment-size-default',
        sm: 'cn-attachment-size-sm',
        xs: 'cn-attachment-size-xs',
      },
      orientation: {
        horizontal: 'cn-attachment-orientation-horizontal items-center',
        vertical: 'cn-attachment-orientation-vertical flex-col',
      },
    },
  },
);
function Attachment(
  __props0: ComponentProps<'div'> &
    VariantProps<typeof attachmentVariants> & {
      state?: 'idle' | 'uploading' | 'processing' | 'error' | 'done';
    },
) {
  return (
    <div
      data-slot="attachment"
      data-state={dataValue(__props0.state === undefined ? 'done' : __props0.state)}
      data-size={dataValue(__props0.size === undefined ? 'default' : __props0.size)}
      data-orientation={dataValue(
        __props0.orientation === undefined ? 'horizontal' : __props0.orientation,
      )}
      class={cn(
        attachmentVariants({
          get size() {
            return __props0.size === undefined ? 'default' : __props0.size;
          },
          get orientation() {
            return __props0.orientation === undefined ? 'horizontal' : __props0.orientation;
          },
        }),
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'state', 'size', 'orientation'])}
    />
  );
}
const attachmentMediaVariants = cva(
  'cn-attachment-media relative flex aspect-square shrink-0 items-center justify-center overflow-hidden group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        icon: 'cn-attachment-media-variant-icon',
        image:
          'cn-attachment-media-variant-image *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'icon',
    },
  },
);
function AttachmentMedia(
  __props1: ComponentProps<'div'> & VariantProps<typeof attachmentMediaVariants>,
) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={dataValue(__props1.variant === undefined ? 'icon' : __props1.variant)}
      class={cn(
        attachmentMediaVariants({
          get variant() {
            return __props1.variant === undefined ? 'icon' : __props1.variant;
          },
        }),
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className', 'variant'])}
    />
  );
}
function AttachmentContent(__props2: ComponentProps<'div'>) {
  return (
    <div
      data-slot="attachment-content"
      class={cn(
        'cn-attachment-content max-w-full min-w-0 flex-1',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function AttachmentTitle(__props3: ComponentProps<'span'>) {
  return (
    <span
      data-slot="attachment-title"
      class={cn(
        'cn-attachment-title block max-w-full min-w-0 truncate group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function AttachmentDescription(__props4: ComponentProps<'span'>) {
  return (
    <span
      data-slot="attachment-description"
      class={cn(
        'cn-attachment-description block min-w-0 truncate text-muted-foreground group-data-[state=error]/attachment:text-destructive/80',
        'max-w-full',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function AttachmentActions(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="attachment-actions"
      class={cn(
        'cn-attachment-actions flex shrink-0 items-center',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function AttachmentAction(__props6: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant={__props6.variant ?? 'ghost'}
      size={__props6.size === undefined ? 'icon-xs' : __props6.size}
      class={cn('cn-attachment-action', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className', 'variant', 'size'])}
    />
  );
}
function AttachmentTrigger(__props7: ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    get props() {
      return mergeProps(
        {
          get type() {
            return __props7.render ? __props7.type : (__props7.type ?? 'button');
          },
          get className() {
            return cn(
              'cn-attachment-trigger absolute inset-0 z-10 outline-none',
              __props7.className ?? __props7.class,
            );
          },
        },
        omitProps(__props7, ['className', 'render', 'type']),
      );
    },
    get render() {
      return __props7.render;
    },
    get state() {
      return {
        slot: 'attachment-trigger',
      };
    },
  });
}
function AttachmentGroup(__props8: ComponentProps<'div'>) {
  return (
    <div
      data-slot="attachment-group"
      class={cn(
        'cn-attachment-group flex min-w-0 scroll-fade-x snap-x snap-mandatory scrollbar-none overflow-x-auto overscroll-x-contain *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start',
        __props8.className ?? __props8.class,
      )}
      {...omitProps(__props8, ['className'])}
    />
  );
}
export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
};
