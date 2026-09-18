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
import { Slider as SliderPrimitive } from '@solid-cn/base-ui/slider';
import { cn } from './utils';
function Slider(__props0: ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = () =>
    Array.isArray(__props0.value)
      ? __props0.value
      : Array.isArray(__props0.defaultValue)
        ? __props0.defaultValue
        : [
            __props0.min === undefined ? 0 : __props0.min,
            __props0.max === undefined ? 100 : __props0.max,
          ];
  return (
    <SliderPrimitive.Root
      class={cn(
        'data-horizontal:w-full data-vertical:h-full',
        __props0.className ?? __props0.class,
      )}
      data-slot="slider"
      defaultValue={__props0.defaultValue}
      value={__props0.value}
      min={__props0.min === undefined ? 0 : __props0.min}
      max={__props0.max === undefined ? 100 : __props0.max}
      thumbAlignment="edge"
      {...omitProps(__props0, ['className', 'defaultValue', 'value', 'min', 'max'])}
    >
      <SliderPrimitive.Control class="cn-slider relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          class="cn-slider-track relative grow overflow-hidden select-none"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            class="cn-slider-range select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from(
          {
            get length() {
              return _values().length;
            },
          },
          (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              class="cn-slider-thumb block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
            />
          ),
        )}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
export { Slider };
