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
import { Progress as ProgressPrimitive } from '@solid-cn/base-ui/progress';
import { cn } from './utils';
function Progress(__props0: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      {...omitProps(__props0, ['className', 'children', 'value'])}
      value={__props0.value}
      data-slot="progress"
      class={cn('cn-progress-root flex flex-wrap gap-3', __props0.className ?? __props0.class)}
    >
      {__props0.children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}
function ProgressTrack(__props1: ComponentProps<typeof ProgressPrimitive.Track>) {
  return (
    <ProgressPrimitive.Track
      class={cn(
        'cn-progress-track relative flex w-full items-center overflow-x-hidden',
        __props1.className ?? __props1.class,
      )}
      data-slot="progress-track"
      {...omitProps(__props1, ['className'])}
    />
  );
}
function ProgressIndicator(__props2: ComponentProps<typeof ProgressPrimitive.Indicator>) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      class={cn(
        'cn-progress-indicator h-full transition-all',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function ProgressLabel(__props3: ComponentProps<typeof ProgressPrimitive.Label>) {
  return (
    <ProgressPrimitive.Label
      class={cn('cn-progress-label', __props3.className ?? __props3.class)}
      data-slot="progress-label"
      {...omitProps(__props3, ['className'])}
    />
  );
}
function ProgressValue(__props4: ComponentProps<typeof ProgressPrimitive.Value>) {
  return (
    <ProgressPrimitive.Value
      class={cn('cn-progress-value', __props4.className ?? __props4.class)}
      data-slot="progress-value"
      {...omitProps(__props4, ['className'])}
    />
  );
}
export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
