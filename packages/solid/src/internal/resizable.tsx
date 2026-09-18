import { createContext, createSignal, createUniqueId, useContext, onCleanup } from 'solid-js';
import { omitProps, type ComponentProps } from '../utils';
export type GroupProps = ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical';
  direction?: 'horizontal' | 'vertical';
  onLayoutChange?: (layout: Record<string, number>) => void;
  defaultLayout?: Record<string, number>;
};
export type PanelProps = ComponentProps<'div'> & {
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  collapsible?: boolean;
  collapsedSize?: number | string;
  onResize?: (size: number) => void;
};
export type SeparatorProps = ComponentProps<'div'>;
type PanelEntry = {
  id: string;
  node: HTMLElement;
  props: PanelProps;
  size: () => number;
  setSize: (size: number) => void;
};
const Context = createContext<{
  vertical: () => boolean;
  register: (entry: PanelEntry) => void;
  resize: (handle: HTMLElement, delta: number) => void;
  group: () => HTMLElement;
} | null>(null);
const numeric = (value: number | string | undefined, fallback: number) =>
  value === undefined ? fallback : typeof value === 'number' ? value : Number.parseFloat(value);
export function Group(props: GroupProps) {
  let group!: HTMLDivElement;
  const panels: PanelEntry[] = [];
  const vertical = () => (props.orientation ?? props.direction) === 'vertical';
  const resize = (handle: HTMLElement, delta: number) => {
    const previous = panels.find((entry) => entry.node === handle.previousElementSibling),
      next = panels.find((entry) => entry.node === handle.nextElementSibling);
    if (!previous || !next) return;
    const total = previous.size() + next.size();
    let size = Math.min(
      numeric(previous.props.maxSize, 100),
      Math.max(
        numeric(
          previous.props.minSize,
          previous.props.collapsible ? numeric(previous.props.collapsedSize, 0) : 0,
        ),
        previous.size() + delta,
      ),
    );
    size = Math.max(
      total - numeric(next.props.maxSize, 100),
      Math.min(size, total - numeric(next.props.minSize, 0)),
    );
    previous.setSize(size);
    next.setSize(total - size);
    previous.props.onResize?.(size);
    next.props.onResize?.(total - size);
    props.onLayoutChange?.(Object.fromEntries(panels.map((entry) => [entry.id, entry.size()])));
  };
  return (
    <Context
      value={{
        vertical,
        group: () => group,
        resize,
        register(entry) {
          panels.push(entry);
          onCleanup(() => {
            const index = panels.indexOf(entry);
            if (index >= 0) panels.splice(index, 1);
          });
        },
      }}
    >
      <div
        {...omitProps(props, ['orientation', 'direction', 'onLayoutChange', 'defaultLayout'])}
        ref={group}
        aria-orientation={vertical() ? 'vertical' : 'horizontal'}
        style={{
          display: 'flex',
          'flex-direction': vertical() ? 'column' : 'row',
          ...(typeof props.style === 'object' ? props.style : {}),
        }}
      />
    </Context>
  );
}
function useGroup() {
  const context = useContext(Context);
  if (!context) throw new Error('Resizable parts must be inside ResizablePanelGroup.');
  return context;
}
export function Panel(props: PanelProps) {
  const context = useGroup(),
    id = props.id ?? createUniqueId();
  const [size, setSize] = createSignal(numeric(props.defaultSize, 50));
  return (
    <div
      {...omitProps(props, [
        'defaultSize',
        'minSize',
        'maxSize',
        'collapsible',
        'collapsedSize',
        'onResize',
      ])}
      id={id}
      ref={(node) => context.register({ id, node, props, size, setSize })}
      style={{
        'flex-basis': 0,
        'flex-grow': size(),
        'min-width': 0,
        'min-height': 0,
        overflow: 'hidden',
        ...(typeof props.style === 'object' ? props.style : {}),
      }}
    />
  );
}
export function Separator(props: SeparatorProps) {
  const context = useGroup();
  let element!: HTMLDivElement;
  let previous = 0;
  let pointer: number | undefined;
  const move = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    const position = context.vertical() ? event.clientY : event.clientX;
    const length = context.vertical() ? context.group().clientHeight : context.group().clientWidth;
    context.resize(element, ((position - previous) / Math.max(1, length)) * 100);
    previous = position;
  };
  return (
    <div
      role="separator"
      tabindex="0"
      {...props}
      ref={element}
      aria-orientation={context.vertical() ? 'horizontal' : 'vertical'}
      style={{
        'touch-action': 'none',
        cursor: context.vertical() ? 'row-resize' : 'col-resize',
        ...(typeof props.style === 'object' ? props.style : {}),
      }}
      onPointerDown={(event) => {
        pointer = event.pointerId;
        previous = context.vertical() ? event.clientY : event.clientX;
        element.setPointerCapture(pointer);
      }}
      onPointerMove={move}
      onPointerUp={() => {
        pointer = undefined;
      }}
      onKeyDown={(event) => {
        const keys = context.vertical() ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
        if (keys.includes(event.key)) {
          event.preventDefault();
          context.resize(element, (event.key === keys[0] ? -1 : 1) * (event.shiftKey ? 10 : 1));
        }
      }}
    />
  );
}
