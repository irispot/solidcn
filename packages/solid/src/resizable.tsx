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
import { cn } from './utils';
import * as ResizablePrimitive from './internal/resizable';
function ResizablePanelGroup(__props0: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      class={cn(
        'cn-resizable-panel-group flex h-full w-full aria-[orientation=vertical]:flex-col',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function ResizablePanel(__props1: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...omitProps(__props1, [])} />;
}
function ResizableHandle(
  __props2: ResizablePrimitive.SeparatorProps & {
    withHandle?: boolean;
  },
) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      class={cn(
        'cn-resizable-handle relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['withHandle', 'className'])}
    >
      {__props2.withHandle && <div class="cn-resizable-handle-icon z-10 flex shrink-0" />}
    </ResizablePrimitive.Separator>
  );
}
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
