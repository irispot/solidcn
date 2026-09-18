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
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
function InputGroup(__props0: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      class={cn(
        'group/input-group cn-input-group relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
const inputGroupAddonVariants = cva(
  'cn-input-group-addon flex cursor-text items-center justify-center select-none',
  {
    variants: {
      align: {
        'inline-start': 'cn-input-group-addon-align-inline-start order-first',
        'inline-end': 'cn-input-group-addon-align-inline-end order-last',
        'block-start': 'cn-input-group-addon-align-block-start order-first w-full justify-start',
        'block-end': 'cn-input-group-addon-align-block-end order-last w-full justify-start',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
);
function InputGroupAddon(
  __props1: ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>,
) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={dataValue(__props1.align === undefined ? 'inline-start' : __props1.align)}
      class={cn(
        inputGroupAddonVariants({
          get align() {
            return __props1.align === undefined ? 'inline-start' : __props1.align;
          },
        }),
        __props1.className ?? __props1.class,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      {...omitProps(__props1, ['className', 'align'])}
    />
  );
}
const inputGroupButtonVariants = cva('cn-input-group-button flex items-center shadow-none', {
  variants: {
    size: {
      xs: 'cn-input-group-button-size-xs',
      sm: 'cn-input-group-button-size-sm',
      'icon-xs': 'cn-input-group-button-size-icon-xs',
      'icon-sm': 'cn-input-group-button-size-icon-sm',
    },
  },
  defaultVariants: {
    size: 'xs',
  },
});
function InputGroupButton(
  __props2: Omit<ComponentProps<typeof Button>, 'size' | 'type'> &
    VariantProps<typeof inputGroupButtonVariants> & {
      type?: 'button' | 'submit' | 'reset';
    },
) {
  return (
    <Button
      type={__props2.type === undefined ? 'button' : __props2.type}
      data-size={dataValue(__props2.size === undefined ? 'xs' : __props2.size)}
      variant={__props2.variant === undefined ? 'ghost' : __props2.variant}
      class={cn(
        inputGroupButtonVariants({
          get size() {
            return __props2.size === undefined ? 'xs' : __props2.size;
          },
        }),
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className', 'type', 'variant', 'size'])}
    />
  );
}
function InputGroupText(__props3: ComponentProps<'span'>) {
  return (
    <span
      class={cn(
        'cn-input-group-text flex items-center [&_svg]:pointer-events-none',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function InputGroupInput(__props4: ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      class={cn('cn-input-group-input flex-1', __props4.className ?? __props4.class)}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function InputGroupTextarea(__props5: ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      class={cn('cn-input-group-textarea flex-1 resize-none', __props5.className ?? __props5.class)}
      {...omitProps(__props5, ['className'])}
    />
  );
}
export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
