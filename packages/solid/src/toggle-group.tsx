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
import { Toggle as TogglePrimitive } from '@solid-cn/base-ui/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@solid-cn/base-ui/toggle-group';
import { type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { toggleVariants } from './toggle';
const ToggleGroupContext = createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: 'horizontal' | 'vertical';
  }
>({
  size: 'default',
  variant: 'default',
  spacing: 2,
  orientation: 'horizontal',
});
function ToggleGroup(
  __props0: ComponentProps<typeof ToggleGroupPrimitive> &
    VariantProps<typeof toggleVariants> & {
      spacing?: number;
      orientation?: 'horizontal' | 'vertical';
    },
) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={dataValue(__props0.variant)}
      data-size={dataValue(__props0.size)}
      data-spacing={dataValue(__props0.spacing === undefined ? 2 : __props0.spacing)}
      data-orientation={dataValue(
        __props0.orientation === undefined ? 'horizontal' : __props0.orientation,
      )}
      style={
        {
          get '--gap'() {
            return __props0.spacing === undefined ? 2 : __props0.spacing;
          },
        } as JSX.CSSProperties
      }
      class={cn(
        'cn-toggle-group group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, [
        'className',
        'variant',
        'size',
        'spacing',
        'orientation',
        'children',
      ])}
    >
      <ToggleGroupContext
        value={{
          get variant() {
            return __props0.variant;
          },
          get size() {
            return __props0.size;
          },
          get spacing() {
            return __props0.spacing === undefined ? 2 : __props0.spacing;
          },
          get orientation() {
            return __props0.orientation === undefined ? 'horizontal' : __props0.orientation;
          },
        }}
      >
        {__props0.children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive>
  );
}
function ToggleGroupItem(
  __props1: ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>,
) {
  const context = useContext(ToggleGroupContext);
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={dataValue(
        context.variant || (__props1.variant === undefined ? 'default' : __props1.variant),
      )}
      data-size={dataValue(
        context.size || (__props1.size === undefined ? 'default' : __props1.size),
      )}
      data-spacing={dataValue(context.spacing)}
      class={cn(
        'cn-toggle-group-item shrink-0 focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t',
        toggleVariants({
          get variant() {
            return (
              context.variant || (__props1.variant === undefined ? 'default' : __props1.variant)
            );
          },
          get size() {
            return context.size || (__props1.size === undefined ? 'default' : __props1.size);
          },
        }),
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className', 'children', 'variant', 'size'])}
    >
      {__props1.children}
    </TogglePrimitive>
  );
}
export { ToggleGroup, ToggleGroupItem };
