import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  useContext,
  Show,
} from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  size,
  type Middleware,
  type MiddlewareState,
  type Placement,
} from '@floating-ui/dom';
import {
  renderElement,
  mergeProps,
  omitProps,
  useTimeout,
  useAnimationFrame,
  useDirection,
  type BaseProps,
} from './core';

export interface ToastObject<Data extends object = Record<string, unknown>> {
  id: string;
  title?: JSX.Element;
  description?: JSX.Element;
  type?: string;
  timeout?: number;
  priority?: 'low' | 'high';
  transitionStatus?: 'starting' | 'ending';
  updateKey?: number;
  limited?: boolean;
  height?: number;
  onClose?: () => void;
  onRemove?: () => void;
  actionProps?: BaseProps;
  positionerProps?: ToastManagerPositionerProps;
  data?: Data;
}
export type ToastOptions<Data extends object = Record<string, unknown>> = Omit<
  ToastObject<Data>,
  'id'
> & { id?: string };
export type ToastManagerAddOptions<Data extends object = Record<string, unknown>> =
  ToastOptions<Data>;
export type ToastManagerUpdateOptions<Data extends object = Record<string, unknown>> =
  Partial<ToastObject<Data>>;
export interface ToastManagerPromiseOptions<
  Value,
  Data extends object = Record<string, unknown>,
> {
  loading: string | ToastOptions<Data>;
  success: string | ToastOptions<Data> | ((value: Value) => string | ToastOptions<Data>);
  error: string | ToastOptions<Data> | ((error: unknown) => string | ToastOptions<Data>);
}
export interface ToastManager<Data extends object = Record<string, unknown>> {
  ' subscribe': (listener: (event: ToastManagerEvent<Data>) => void) => () => void;
  readonly toasts: ToastObject<Data>[];
  add: (options: ToastManagerAddOptions<Data>) => string;
  close: (id?: string) => void;
  update: (
    id: string,
    changes:
      | ToastManagerUpdateOptions<Data>
      | ((previous: ToastObject<Data>) => ToastManagerUpdateOptions<Data>),
  ) => void;
  promise: <T>(
    promise: Promise<T>,
    options: ToastManagerPromiseOptions<T, Data>,
  ) => Promise<T>;
  /** @internal */ remove: (id: string) => void;
  /** @internal */ mounted: Set<string>;
}
export type UseToastManagerReturnValue<Data extends object = Record<string, unknown>> =
  ToastManager<Data>;
export interface ToastManagerEvent<Data extends object = Record<string, unknown>> {
  action: 'add' | 'close' | 'update' | 'promise';
  options: unknown;
}
let nextId = 0;
export function createToastManager<
  Data extends object = Record<string, unknown>,
>(): ToastManager<Data> {
  const [toasts, setToasts] = createSignal<ToastObject<Data>[]>([]);
  const mounted = new Set<string>();
  const listeners = new Set<(event: ToastManagerEvent<Data>) => void>();
  const emit = (event: ToastManagerEvent<Data>) => {
    listeners.forEach((listener) => listener(event));
  };
  const manager: ToastManager<Data> = {
    ' subscribe'(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get toasts() {
      return toasts();
    },
    mounted,
    add(options) {
      const id = options.id ?? `solid-toast-${++nextId}`;
      const previous = toasts().find((item) => item.id === id);
      const toast = { ...options, id, updateKey: (previous?.updateKey ?? 0) + 1 };
      setToasts((items) =>
        previous ? items.map((item) => (item.id === id ? toast : item)) : [toast, ...items],
      );
      emit({ action: 'add', options: toast });
      return id;
    },
    close(id) {
      emit({ action: 'close', options: { id } });
      const closing = toasts().filter(
        (item) => (!id || item.id === id) && item.transitionStatus !== 'ending',
      );
      setToasts((items) =>
        items.map((item) =>
          closing.includes(item) ? { ...item, transitionStatus: 'ending' as const } : item,
        ),
      );
      closing.forEach((item) => {
        item.onClose?.();
        if (!mounted.has(item.id)) manager.remove(item.id);
      });
    },
    remove(id) {
      const item = toasts().find((item) => item.id === id);
      setToasts((items) => items.filter((item) => item.id !== id));
      item?.onRemove?.();
    },
    update(id, changes) {
      emit({ action: 'update', options: { id, updates: changes } });
      setToasts((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(typeof changes === 'function' ? changes(item) : changes),
                id,
                updateKey: (item.updateKey ?? 0) + 1,
              }
            : item,
        ),
      );
    },
    async promise(promise, options) {
      emit({ action: 'promise', options: { ...options, promise } });
      const normalize = (value: string | ToastOptions<Data>) =>
        typeof value === 'string' ? { title: value } : value;
      const id = manager.add({ type: 'loading', timeout: 0, ...normalize(options.loading) });
      try {
        const value = await promise;
        manager.update(id, {
          type: 'success',
          timeout: 5000,
          ...normalize(
            typeof options.success === 'function' ? options.success(value) : options.success,
          ),
        });
        return value;
      } catch (error) {
        manager.update(id, {
          type: 'error',
          timeout: 5000,
          ...normalize(typeof options.error === 'function' ? options.error(error) : options.error),
        });
        throw error;
      }
    },
  };
  return manager;
}
const ToastContext = createContext<{
  manager: ToastManager<any>;
  props: BaseProps;
  paused: () => boolean;
  setFocused: (value: boolean) => void;
  setDocumentHidden: (value: boolean) => void;
  setWindowBlurred: (value: boolean) => void;
  enter: () => void;
  leave: () => void;
  beginTouch: () => void;
  endTouch: () => void;
  clearInteraction: () => void;
  heights: () => Record<string, number>;
  setHeight: (id: string, height: number) => void;
} | null>(null);
const ToastItem = createContext<(() => ToastObject<any>) | null>(null);
const ToastLabels = createContext<{
  titleId: () => string | undefined;
  descriptionId: () => string | undefined;
  setTitleId: (id: string | undefined) => void;
  setDescriptionId: (id: string | undefined) => void;
}>();
export interface ToastProviderProps extends BaseProps {
  toastManager?: ToastManager<any>;
  timeout?: number;
  limit?: number;
}
export interface ToastProviderState {}
export interface ToastViewportState {
  expanded: boolean;
}
export interface ToastViewportProps extends BaseProps<ToastViewportState> {
  hotkey?: string[];
}
export interface ToastRootState {
  expanded: boolean;
  limited: boolean;
  endingStyle: boolean;
  swiping: boolean;
  type?: string;
}
export interface ToastRootProps extends BaseProps<ToastRootState> {
  toast: ToastObject<any>;
  swipeDirection?: 'up' | 'down' | 'left' | 'right' | ('up' | 'down' | 'left' | 'right')[];
}
export type ToastRootToastObject<Data extends object = Record<string, unknown>> =
  ToastObject<Data>;
export interface ToastContentState {
  expanded: boolean;
  behind: boolean;
}
export type ToastContentProps = BaseProps<ToastContentState>;
export interface ToastActionState {
  type?: string;
}
export type ToastActionProps = BaseProps<ToastActionState>;
export interface ToastCloseState {
  type?: string;
}
export type ToastCloseProps = BaseProps<ToastCloseState>;
export interface ToastTitleState {
  type?: string;
}
export type ToastTitleProps = BaseProps<ToastTitleState>;
export interface ToastDescriptionState {
  type?: string;
}
export type ToastDescriptionProps = BaseProps<ToastDescriptionState>;
export interface ToastPortalState {}
export interface ToastPortalProps extends BaseProps<ToastPortalState> {
  container?: HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null;
}
function hasRenderableToastContent(value: unknown): boolean {
  if (value == null || typeof value === 'boolean' || value === '') return false;
  if (typeof value === 'function') return hasRenderableToastContent(value());
  if (typeof Node !== 'undefined' && value instanceof Node)
    return value.nodeType === Node.TEXT_NODE
      ? Boolean(value.textContent)
      : value.childNodes.length > 0;
  return Array.isArray(value) ? value.some(hasRenderableToastContent) : true;
}
function useToastItem() {
  const item = useContext(ToastItem);
  if (!item)
    throw new Error('Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.');
  return item;
}
function useToastProvider() {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error('Base UI: useToastManager must be used within <Toast.Provider>.');
  return context;
}
function ToastProvider(props: ToastProviderProps) {
  const manager = (props.toastManager ?? createToastManager()) as ToastManager<any>;
  const [hovering, setHovering] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [documentHidden, setDocumentHidden] = createSignal(false);
  const [windowBlurred, setWindowBlurred] = createSignal(false);
  const paused = () => hovering() || focused() || documentHidden() || windowBlurred();
  let touchActive = false;
  let deferredLeave = false;
  const enter = () => {
    deferredLeave = false;
    setHovering(true);
  };
  const leave = () => {
    if (touchActive) deferredLeave = true;
    else setHovering(false);
  };
  const beginTouch = () => {
    touchActive = true;
    deferredLeave = false;
    setHovering(true);
  };
  const endTouch = () => {
    touchActive = false;
    if (deferredLeave) {
      deferredLeave = false;
      setHovering(false);
    }
  };
  const clearInteraction = () => {
    touchActive = false;
    deferredLeave = false;
    setHovering(false);
    setFocused(false);
  };
  const [heights, setHeights] = createSignal<Record<string, number>>({});
  const setHeight = (id: string, height: number) =>
    setHeights((previous) => (previous[id] === height ? previous : { ...previous, [id]: height }));
  return (
    <ToastContext value={{ manager, props, paused, setFocused, setDocumentHidden, setWindowBlurred, enter, leave, beginTouch, endTouch, clearInteraction, heights, setHeight }}>
      {props.children}
    </ToastContext>
  );
}
export function useToastManager<Data extends object = Record<string, unknown>>() {
  return useToastProvider().manager as ToastManager<Data>;
}
function ToastViewport(props: ToastViewportProps) {
  const context = useToastProvider();
  const [node, setNode] = createSignal<HTMLElement | undefined>(undefined);
  const [previousFocus, setPreviousFocus] = createSignal<HTMLElement | null>(null);
  const activeNode = createMemo(() => context.manager.toasts.length > 0 ? node() : undefined);
  const focusableToast = (viewport: HTMLElement) =>
    Array.from(viewport.querySelectorAll<HTMLElement>('[data-toast-root]')).find(
      (root) => !root.hasAttribute('data-ending-style') && !root.hasAttribute('data-limited'),
    );
  const restorePreviousFocus = () => {
    const previous = previousFocus();
    previous?.focus();
    if (!node()?.contains(previous)) context.setFocused(false);
  };
  const focusGuard = () => (
    <span
      tabindex={context.manager.toasts.length > 0 && previousFocus() ? 0 : -1}
      aria-hidden="true"
      data-base-ui-focus-guard=""
      style={{ position: 'fixed', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', 'white-space': 'nowrap', border: 0 }}
      onFocus={(event) => {
        const viewport = node();
        const target = event.relatedTarget === viewport && viewport && focusableToast(viewport);
        if (target) target.focus();
        else restorePreviousFocus();
      }}
    />
  );
  createEffect(
    activeNode,
    (node) => {
      if (!node) return;
      const document = node.ownerDocument;
      const win = document.defaultView;
      if (!win) return;
      const keyboard = (event: KeyboardEvent) => {
        if (event.target !== node && (props.hotkey ?? ['F6']).includes(event.key)) {
          event.preventDefault();
          const previous = document.activeElement as HTMLElement | null;
          node.focus({ preventScroll: true });
          setPreviousFocus(previous);
          context.setFocused(true);
        }
      };
      const visibility = () => context.setDocumentHidden(document.hidden);
      const isWindowEvent = (event: FocusEvent) =>
        (event.composedPath?.()[0] ?? event.target) === win;
      const blur = (event: FocusEvent) => {
        if (isWindowEvent(event)) context.setWindowBlurred(true);
      };
      const focus = (event: FocusEvent) => {
        if (isWindowEvent(event) && !event.relatedTarget) context.setWindowBlurred(false);
      };
      const pointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'touch' && !node.contains(event.target as Node))
          context.clearInteraction();
      };
      const unsubscribe = context.manager[' subscribe']((event) => {
        if (event.action !== 'close' || !node.contains(document.activeElement)) return;
        const closedId = (event.options as { id?: string }).id;
        const index = context.manager.toasts.findIndex((toast) => toast.id === closedId);
        queueMicrotask(() => {
          if (closedId === undefined) {
            restorePreviousFocus();
            return;
          }
          const toasts = context.manager.toasts;
          const roots = Array.from(node.querySelectorAll<HTMLElement>('[data-toast-root]'));
          const available = (at: number) =>
            toasts[at]?.transitionStatus !== 'ending' && !toasts[at]?.limited
              ? roots[at]
              : undefined;
          let next: HTMLElement | undefined;
          for (let at = index + 1; at < toasts.length && !next; at += 1)
            next = available(at);
          for (let at = index - 1; at >= 0 && !next; at -= 1)
            next = available(at);
          if (next) next.focus();
          else restorePreviousFocus();
        });
      });
      win.addEventListener('keydown', keyboard);
      win.addEventListener('blur', blur, true);
      win.addEventListener('focus', focus, true);
      document.addEventListener('pointerdown', pointerDown, true);
      document.addEventListener('visibilitychange', visibility);
      return () => {
        unsubscribe();
        win.removeEventListener('keydown', keyboard);
        win.removeEventListener('blur', blur, true);
        win.removeEventListener('focus', focus, true);
        document.removeEventListener('pointerdown', pointerDown, true);
        document.removeEventListener('visibilitychange', visibility);
      };
    },
  );
  const viewport = renderElement(
    'div',
    props,
    {
      get expanded() {
        return context.paused();
      },
    },
    {
      ref: setNode,
      role: 'region',
      'aria-label': props['aria-label'] ?? 'Notifications',
      tabIndex: -1,
      onPointerEnter: context.enter,
      onPointerLeave: context.leave,
      onMouseEnter: context.enter,
      onMouseLeave: context.leave,
      onFocus: () => context.setFocused(true),
      onBlur: (event: FocusEvent) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node))
          context.setFocused(false);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Tab' && event.shiftKey && event.target === node()) {
          event.preventDefault();
          restorePreviousFocus();
        }
      },
    },
  );
  return (
    <>
      {focusGuard()}
      {viewport}
      {focusGuard()}
    </>
  );
}
function ToastRoot(props: ToastRootProps) {
  const context = useToastProvider();
  const timer = useTimeout();
  const frame = useAnimationFrame();
  const [height, setHeight] = createSignal(0);
  const [node, setNode] = createSignal<HTMLElement | undefined>(undefined);
  const [movement, setMovement] = createSignal({ x: 0, y: 0 });
  const [swiping, setSwiping] = createSignal(false);
  const [titleId, setTitleId] = createSignal<string>();
  const [descriptionId, setDescriptionId] = createSignal<string>();
  let start: { x: number; y: number } | undefined;
  let remaining = props.toast.timeout ?? context.props.timeout ?? 5000;
  let began = 0;
  createEffect(
    () => [props.toast.updateKey, props.toast.timeout] as const,
    () => {
      remaining = props.toast.timeout ?? context.props.timeout ?? 5000;
    },
  );
  createEffect(
    () => ({
      paused: context.paused(),
      toast: props.toast,
      timeout: props.toast.timeout ?? context.props.timeout ?? 5000,
    }),
    ({ paused, toast, timeout }) => {
      if (!paused && timeout > 0) {
        began = Date.now();
        timer.start(remaining, () => context.manager.close(toast.id));
      }
      return () => {
        timer.clear();
        if (!paused && timeout > 0) remaining = Math.max(0, remaining - (Date.now() - began));
      };
    },
  );
  createEffect(
    () => node(),
    (node) => {
      if (!node) return;
      context.manager.mounted.add(props.toast.id);
      const update = () => {
        const previous = node.style.getPropertyValue('height');
        const priority = node.style.getPropertyPriority('height');
        node.style.setProperty('height', 'auto');
        const height = node.getBoundingClientRect().height;
        if (previous) node.style.setProperty('height', previous, priority);
        else node.style.removeProperty('height');
        setHeight(height);
        context.setHeight(props.toast.id, height);
      };
      update();
      const Resize = node.ownerDocument.defaultView?.ResizeObserver;
      const observer = Resize ? new Resize(update) : undefined;
      observer?.observe(node);
      return () => {
        observer?.disconnect();
        context.manager.mounted.delete(props.toast.id);
      };
    },
  );
  createEffect(
    () => ({ ending: props.toast.transitionStatus === 'ending', node: node() }),
    ({ ending, node }) => {
      if (!ending || !node) return;
      let canceled = false;
      const toastId = props.toast.id;
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      const hasDuration = (value: string | undefined) =>
        (value ?? '').split(',').some((part) => Number.parseFloat(part) > 0);
      const hasMotion =
        (hasDuration(style?.animationDuration) && style?.animationName !== 'none') ||
        hasDuration(style?.transitionDuration);
      if (!hasMotion && !(node.getAnimations?.({ subtree: true }) ?? []).length) {
        queueMicrotask(() => {
          if (!canceled) context.manager.remove(toastId);
        });
        return () => {
          canceled = true;
        };
      }
      frame.request(() => {
        Promise.allSettled(
          (node.getAnimations?.({ subtree: true }) ?? []).map((animation) => animation.finished),
        ).then(() => {
          if (!canceled) context.manager.remove(toastId);
        });
      });
      return () => {
        canceled = true;
        frame.cancel();
      };
    },
  );
  const index = () => context.manager.toasts.findIndex((toast) => toast.id === props.toast.id);
  return (
    <ToastItem value={() => props.toast}>
      <ToastLabels value={{ titleId, descriptionId, setTitleId, setDescriptionId }}>
        {renderElement(
          'div',
          omitProps(props, ['toast', 'swipeDirection']),
          {
            get expanded() {
              return context.paused();
            },
            get limited() {
              return index() >= (context.props.limit ?? 3);
            },
            get endingStyle() {
              return props.toast.transitionStatus === 'ending';
            },
            get swiping() {
              return swiping();
            },
            get type() {
              return props.toast.type;
            },
          },
          {
            ref: setNode,
            'data-toast-root': '',
            tabIndex: 0,
            get role() {
              return props.toast.priority === 'high' ? 'alertdialog' : 'dialog';
            },
            'aria-modal': false,
            get 'aria-labelledby'() {
              return titleId();
            },
            get 'aria-describedby'() {
              return descriptionId();
            },
            get style() {
              return {
                '--toast-index': index(),
                '--toast-height': `${height()}px`,
                '--toast-frontmost-height': `${context.heights()[context.manager.toasts[0]?.id] ?? height()}px`,
                '--toast-offset-y': `${context.manager.toasts.slice(0, index()).reduce((sum, toast) => sum + (context.heights()[toast.id] ?? 0), 0)}px`,
                '--toast-swipe-movement-x': `${movement().x}px`,
                '--toast-swipe-movement-y': `${movement().y}px`,
              };
            },
            onPointerDown(event: PointerEvent) {
              if (event.button === 0 && event.pointerType === 'touch') {
                start = { x: event.clientX, y: event.clientY };
                setSwiping(true);
                context.beginTouch();
                (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
              }
            },
            onPointerMove(event: PointerEvent) {
              if (start) setMovement({ x: event.clientX - start.x, y: event.clientY - start.y });
            },
            onPointerUp() {
              if (Math.abs(movement().x) > 70 || Math.abs(movement().y) > 70)
                context.manager.close(props.toast.id);
              if (start) context.endTouch();
              start = undefined;
              setSwiping(false);
              setMovement({ x: 0, y: 0 });
            },
            onPointerCancel() {
              if (start) context.endTouch();
              start = undefined;
              setSwiping(false);
              setMovement({ x: 0, y: 0 });
            },
            onMouseEnter: context.enter,
            onMouseLeave(event: MouseEvent) {
              const viewport = (event.currentTarget as HTMLElement).closest('[role="region"]');
              if (!viewport?.contains(event.relatedTarget as Node | null)) context.leave();
            },
            onKeyDown(event: KeyboardEvent) {
              if (event.key === 'Escape') context.manager.close(props.toast.id);
            },
          },
        )}
      </ToastLabels>
    </ToastItem>
  );
}
function ToastTitle(props: ToastTitleProps) {
  const item = useToastItem();
  const labels = useContext(ToastLabels)!;
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  const content = () => props.children ?? item().title;
  const element = renderElement(
    'h2',
    props,
    {
      get type() {
        return item().type;
      },
    },
    {
      get id() {
        return id();
      },
      get children() {
        return content();
      },
    },
  );
  const present = () =>
    hasRenderableToastContent(content()) ||
    (props.render != null && hasRenderableToastContent(element));
  let registration = 0;
  createEffect(
    () => ({ present: present(), id: id() }),
    ({ present, id }) => {
      if (!present) return;
      const currentRegistration = ++registration;
      labels.setTitleId(id);
      return () => {
        queueMicrotask(() => {
          if (registration === currentRegistration && labels.titleId() === id)
            labels.setTitleId(undefined);
        });
      };
    },
  );
  return (
    <Show when={present()}>
      {element}
    </Show>
  );
}
function ToastDescription(props: ToastDescriptionProps) {
  const item = useToastItem();
  const labels = useContext(ToastLabels)!;
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  const content = () => props.children ?? item().description;
  const element = renderElement(
    'p',
    props,
    {
      get type() {
        return item().type;
      },
    },
    {
      get id() {
        return id();
      },
      get children() {
        return content();
      },
    },
  );
  const present = () =>
    hasRenderableToastContent(content()) ||
    (props.render != null && hasRenderableToastContent(element));
  let registration = 0;
  createEffect(
    () => ({ present: present(), id: id() }),
    ({ present, id }) => {
      if (!present) return;
      const currentRegistration = ++registration;
      labels.setDescriptionId(id);
      return () => {
        queueMicrotask(() => {
          if (registration === currentRegistration && labels.descriptionId() === id)
            labels.setDescriptionId(undefined);
        });
      };
    },
  );
  return (
    <Show when={present()}>
      {element}
    </Show>
  );
}
function ToastClose(props: ToastCloseProps) {
  const root = useToastProvider();
  const item = useToastItem();
  return renderElement(
    'button',
    props,
    {},
    {
      type: 'button',
      'aria-label': 'Close notification',
      onClick: () => root.manager.close(item().id),
    },
  );
}
function ToastAction(props: ToastActionProps) {
  const item = useToastItem();
  const actionProps = mergeProps(props, () => item().actionProps ?? {});
  const element = renderElement(
    'button',
    actionProps,
    {
      get type() {
        return item().type;
      },
    },
    { type: 'button' },
  );
  const present = () =>
    hasRenderableToastContent(actionProps.children) ||
    (props.render != null && hasRenderableToastContent(element));
  return <Show when={present()}>{element}</Show>;
}
function ToastContent(props: ToastContentProps) {
  const context = useToastProvider();
  const item = useToastItem();
  const state: ToastContentState = {
    get expanded() {
      return context.paused();
    },
    get behind() {
      return context.manager.toasts
        .filter((toast) => toast.transitionStatus !== 'ending')
        .findIndex((toast) => toast.id === item().id) > 0;
    },
  };
  return renderElement('div', props, state);
}
function ToastPortal(props: ToastPortalProps) {
  const container = () =>
    props.container && 'current' in props.container ? props.container.current : props.container;
  return (
    <Portal mount={(container() ?? undefined) as HTMLElement | undefined}>
      {renderElement('div', omitProps(props, ['container']))}
    </Portal>
  );
}
type ToastSide = NonNullable<BaseProps['side']>;
type ToastAlign = NonNullable<BaseProps['align']>;
export interface ToastPositionerState {
  [key: string]: unknown;
  side: ToastSide;
  align: ToastAlign;
  anchorHidden: boolean;
}
export interface ToastPositionerProps extends BaseProps<ToastPositionerState> {
  toast: ToastObject<any>;
  anchor?: Element | null;
  positionMethod?: 'absolute' | 'fixed';
  collisionBoundary?: 'clipping-ancestors' | Element | Element[];
  collisionPadding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  arrowPadding?: number;
  sticky?: boolean;
  disableAnchorTracking?: boolean;
  collisionAvoidance?: {
    side?: 'flip' | 'shift' | 'none';
    align?: 'flip' | 'shift' | 'none';
    fallbackAxisSide?: 'start' | 'end' | 'none';
  };
}
export type ToastManagerPositionerProps = Omit<ToastPositionerProps, 'toast'>;
export interface ToastArrowState {
  side: ToastSide;
  align: ToastAlign;
  uncentered: boolean;
}
export type ToastArrowProps = BaseProps<ToastArrowState>;
const ToastPositionerContext = createContext<{
  side: () => ToastSide;
  align: () => ToastAlign;
  arrow: () => HTMLElement | undefined;
  setArrow: (element: HTMLElement) => void;
  arrowStyles: () => Record<string, string>;
  arrowUncentered: () => boolean;
} | null>(null);
/** Base UI positions toast arrows against the outer Positioner, not their DOM offset parent. */
function toastArrowMiddleware(element: HTMLElement, padding: number): Middleware {
  return {
    name: 'arrow',
    options: { element, padding, offsetParent: 'floating' },
    async fn(state) {
      const { x, y, placement, rects, platform, elements, middlewareData } = state;
      const axis = placement.startsWith('top') || placement.startsWith('bottom') ? 'x' : 'y';
      const length = axis === 'x' ? 'width' : 'height';
      const minProp = axis === 'x' ? 'left' : 'top';
      const maxProp = axis === 'x' ? 'right' : 'bottom';
      const clientProp = axis === 'x' ? 'clientWidth' : 'clientHeight';
      const arrowDimensions = await platform.getDimensions(element);
      const floating = elements.floating as HTMLElement;
      const clientSize = floating[clientProp] || rects.floating[length];
      const coordinates = { x, y };
      const endDiff =
        rects.reference[length] +
        rects.reference[axis] -
        coordinates[axis] -
        rects.floating[length];
      const startDiff = coordinates[axis] - rects.reference[axis];
      const centerToReference = endDiff / 2 - startDiff / 2;
      const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
      const minPadding = Math.min(padding, largestPossiblePadding);
      const maxPadding = Math.min(padding, largestPossiblePadding);
      const min = minPadding;
      const max = clientSize - arrowDimensions[length] - maxPadding;
      const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
      const arrowOffset = Math.max(min, Math.min(center, max));
      const aligned = placement.includes('-');
      const shouldAddOffset =
        !middlewareData.arrow &&
        aligned &&
        center !== arrowOffset &&
        rects.reference[length] / 2 -
          (center < min ? minPadding : maxPadding) -
          arrowDimensions[length] / 2 <
          0;
      const alignmentOffset = shouldAddOffset ? (center < min ? center - min : center - max) : 0;
      return {
        [axis]: coordinates[axis] + alignmentOffset,
        data: {
          [axis]: arrowOffset,
          centerOffset: center - arrowOffset - alignmentOffset,
          ...(shouldAddOffset && { alignmentOffset }),
        },
        reset: shouldAddOffset,
      };
    },
  };
}
const toastPositionKeys = [
  'toast',
  'anchor',
  'positionMethod',
  'side',
  'align',
  'sideOffset',
  'alignOffset',
  'collisionBoundary',
  'collisionPadding',
  'arrowPadding',
  'sticky',
  'disableAnchorTracking',
  'collisionAvoidance',
  'style',
];
function ToastPositioner(props: ToastPositionerProps) {
  const provider = useContext(ToastContext);
  if (!provider)
    throw new Error('Base UI: useToastManager must be used within <Toast.Provider>.');
  const direction = useDirection();
  const [element, setElement] = createSignal<HTMLElement>();
  const [arrowElement, setArrowElement] = createSignal<HTMLElement>();
  const [placement, setPlacement] = createSignal<Placement>('top');
  const [anchorHidden, setAnchorHidden] = createSignal(false);
  const [arrowStyles, setArrowStyles] = createSignal<Record<string, string>>({
    position: 'absolute',
  });
  const [arrowUncentered, setArrowUncentered] = createSignal(false);
  const [positionStyles, setPositionStyles] = createSignal<Record<string, string>>({
    position: 'fixed',
    top: '0px',
    left: '0px',
    opacity: '0',
  });
  const [positionVars, setPositionVars] = createSignal<Record<string, string>>({
    '--available-width': '100vw',
    '--available-height': '100vh',
  });
  const setting = (name: string, fallback?: any) =>
    props[name] === undefined ? (props.toast.positionerProps?.[name] ?? fallback) : props[name];
  const requestedSide = () => (setting('side', 'top') as ToastSide);
  const requestedAlign = () => (setting('align', 'center') as ToastAlign);
  const physicalSide = (side: ToastSide): 'top' | 'right' | 'bottom' | 'left' => {
    if (side === 'inline-start') return direction() === 'rtl' ? 'right' : 'left';
    if (side === 'inline-end') return direction() === 'rtl' ? 'left' : 'right';
    return side;
  };
  const logicalSide = (physical: string): ToastSide => {
    if (requestedSide() !== 'inline-start' && requestedSide() !== 'inline-end')
      return physical as ToastSide;
    if (physical === 'right') return direction() === 'rtl' ? 'inline-start' : 'inline-end';
    if (physical === 'left') return direction() === 'rtl' ? 'inline-end' : 'inline-start';
    return physical as ToastSide;
  };
  const side = () => logicalSide(placement().split('-')[0]);
  const align = () => (placement().split('-')[1] ?? 'center') as ToastAlign;
  const state: ToastPositionerState = {
    get side() {
      return side();
    },
    get align() {
      return align();
    },
    get anchorHidden() {
      return anchorHidden();
    },
  };
  const domIndex = () => provider.manager.toasts.findIndex((toast) => toast.id === props.toast.id);
  const visibleIndex = () =>
    provider.manager.toasts
      .filter((toast) => toast.transitionStatus !== 'ending')
      .findIndex((toast) => toast.id === props.toast.id);
  const offsetValue = (value: unknown, floating: MiddlewareState) => {
    if (typeof value !== 'function') return Number(value ?? 0);
    const [renderedSide, renderedAlign] = floating.placement.split('-');
    return Number(
      value({
        side: logicalSide(renderedSide),
        align: renderedAlign ?? 'center',
        anchor: {
          width: floating.rects.reference.width,
          height: floating.rects.reference.height,
        },
        positioner: {
          width: floating.rects.floating.width,
          height: floating.rects.floating.height,
        },
      }),
    );
  };
  createEffect(
    () => ({
      node: element(),
      anchor: setting('anchor') as Element | null | undefined,
      arrow: arrowElement(),
      side: requestedSide(),
      align: requestedAlign(),
      sideOffset: setting('sideOffset', 0),
      alignOffset: setting('alignOffset', 0),
      strategy: setting('positionMethod', 'absolute') as 'absolute' | 'fixed',
      boundary: setting('collisionBoundary', 'clipping-ancestors'),
      padding: setting('collisionPadding', 5),
      arrowPadding: setting('arrowPadding', 5),
      sticky: setting('sticky', false),
      avoid: setting('collisionAvoidance', {}),
      trackAnchor: !setting('disableAnchorTracking', false),
      direction: direction(),
    }),
    (config) => {
      const initialSide = physicalSide(config.side);
      setPlacement(
        (config.align === 'center' ? initialSide : `${initialSide}-${config.align}`) as Placement,
      );
      setAnchorHidden(false);
      setPositionStyles({ position: 'fixed', top: '0px', left: '0px', opacity: '0' });
      setPositionVars({ '--available-width': '100vw', '--available-height': '100vh' });
      setArrowStyles({ position: 'absolute' });
      setArrowUncentered(false);
      const { node, anchor } = config;
      if (!node || !anchor || typeof anchor.getBoundingClientRect !== 'function') return;
      let active = true;
      const boundary =
        config.boundary === 'clipping-ancestors' ? 'clippingAncestors' : config.boundary;
      const collision = { boundary, padding: config.padding };
      const sideMode = config.avoid?.side ?? 'flip';
      const alignMode = config.avoid?.align ?? 'flip';
      const shiftDisabled = alignMode === 'none' && sideMode !== 'shift';
      const flipMiddleware =
        sideMode === 'none'
          ? null
          : flip({
              ...collision,
              mainAxis: sideMode === 'flip',
              crossAxis: alignMode === 'flip' ? 'alignment' : false,
              fallbackAxisSideDirection:
                config.avoid?.fallbackAxisSide === 'none'
                  ? undefined
                  : (config.avoid?.fallbackAxisSide ?? 'end'),
            });
      const shiftMiddleware = shiftDisabled
        ? null
        : shift({
            ...collision,
            mainAxis: alignMode !== 'none',
            crossAxis: config.sticky || sideMode === 'shift',
          });
      const update = async () => {
        let sideDistance = 0;
        const result = await computePosition(anchor, node, {
          placement: `${initialSide}${config.align === 'center' ? '' : `-${config.align}`}` as Placement,
          strategy: config.strategy,
          middleware: [
            offset((floating) => {
              sideDistance = offsetValue(config.sideOffset, floating);
              const alignDistance = offsetValue(config.alignOffset, floating);
              return {
                mainAxis: sideDistance,
                crossAxis: alignDistance,
                alignmentAxis: alignDistance,
              };
            }),
            ...(sideMode === 'shift' || alignMode === 'shift' || config.align === 'center'
              ? [shiftMiddleware, flipMiddleware]
              : [flipMiddleware, shiftMiddleware]),
            size({
              ...collision,
              apply({ availableWidth, availableHeight, rects }) {
                if (!active) return;
                const scale = node.ownerDocument.defaultView?.devicePixelRatio || 1;
                const { x, y, width, height } = rects.reference;
                setPositionVars((previous) => ({
                  ...previous,
                  '--available-width': `${availableWidth}px`,
                  '--available-height': `${availableHeight}px`,
                  '--anchor-width': `${(Math.round((x + width) * scale) - Math.round(x * scale)) / scale}px`,
                  '--anchor-height': `${(Math.round((y + height) * scale) - Math.round(y * scale)) / scale}px`,
                }));
              },
            }),
            ...(config.arrow
              ? [toastArrowMiddleware(config.arrow, config.arrowPadding)]
              : []),
            hide({ ...collision, strategy: 'referenceHidden' }),
          ],
        });
        if (!active) return;
        setPlacement(result.placement);
        setAnchorHidden(Boolean(result.middlewareData.hide?.referenceHidden));
        const arrowData = result.middlewareData.arrow;
        setArrowStyles({
          position: 'absolute',
          ...(arrowData?.x !== undefined ? { left: `${arrowData.x}px` } : {}),
          ...(arrowData?.y !== undefined ? { top: `${arrowData.y}px` } : {}),
        });
        setArrowUncentered(arrowData?.centerOffset !== 0);
        const scale = node.ownerDocument.defaultView?.devicePixelRatio || 1;
        const round = (value: number) => Math.round(value * scale) / scale;
        setPositionStyles({
          position: config.strategy,
          left: '0px',
          top: '0px',
          transform:
            scale >= 1.5
              ? `translate3d(${round(result.x)}px, ${round(result.y)}px, 0)`
              : `translate(${round(result.x)}px, ${round(result.y)}px)`,
        });
        const renderedSide = result.placement.split('-')[0];
        const vertical = renderedSide === 'top' || renderedSide === 'bottom';
        const crossOrigin = config.arrow
          ? `${(vertical ? (arrowData?.x ?? 0) + config.arrow.offsetWidth / 2 : (arrowData?.y ?? 0) + config.arrow.offsetHeight / 2)}px`
          : result.placement.endsWith('-start')
            ? '0%'
            : result.placement.endsWith('-end')
              ? '100%'
              : '50%';
        const sideOrigin =
          renderedSide === 'top' || renderedSide === 'left'
            ? `calc(100% + ${sideDistance}px)`
            : `${-sideDistance}px`;
        setPositionVars((previous) => ({
          ...previous,
          '--transform-origin': vertical
            ? `${crossOrigin} ${sideOrigin}`
            : `${sideOrigin} ${crossOrigin}`,
        }));
      };
      const cleanup = autoUpdate(anchor, node, update, {
        ancestorScroll: config.trackAnchor,
        elementResize: config.trackAnchor,
        layoutShift: config.trackAnchor,
      });
      return () => {
        active = false;
        cleanup();
      };
    },
  );
  const elementProps = mergeProps(omitProps(props, toastPositionKeys), {
    ref: setElement,
    get style() {
      const computed = {
        ...positionStyles(),
        ...positionVars(),
        '--toast-index':
          props.toast.transitionStatus === 'ending' ? domIndex() : visibleIndex(),
      };
      const caller = typeof props.style === 'function' ? props.style(state) : props.style;
      if (typeof caller === 'string')
        return `${Object.entries(computed)
          .map(([key, value]) => `${key}:${value}`)
          .join(';')};${caller}`;
      return { ...computed, ...(caller && typeof caller === 'object' ? caller : {}) };
    },
  });
  return (
    <ToastPositionerContext
      value={{ side, align, arrow: arrowElement, setArrow: setArrowElement, arrowStyles, arrowUncentered }}
    >
      {renderElement('div', elementProps, state, { role: 'presentation' })}
    </ToastPositionerContext>
  );
}
function ToastArrow(props: ToastArrowProps) {
  const context = useContext(ToastPositionerContext);
  if (!context)
    throw new Error(
      'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
    );
  const state = {
    get side() {
      return context.side();
    },
    get align() {
      return context.align();
    },
    get uncentered() {
      return context.arrowUncentered();
    },
  };
  const elementProps = mergeProps(omitProps(props, ['style']), {
    ref: context.setArrow,
    get style() {
      const caller = typeof props.style === 'function' ? props.style(state) : props.style;
      if (typeof caller === 'string')
        return `${Object.entries(context.arrowStyles())
          .map(([key, value]) => `${key}:${value}`)
          .join(';')};${caller}`;
      return {
        ...context.arrowStyles(),
        ...(caller && typeof caller === 'object' ? caller : {}),
      };
    },
  });
  return renderElement('div', elementProps, state, { 'aria-hidden': true });
}
export const Toast = {
  Provider: ToastProvider,
  Viewport: ToastViewport,
  Root: ToastRoot,
  Title: ToastTitle,
  Description: ToastDescription,
  Close: ToastClose,
  Action: ToastAction,
  Content: ToastContent,
  Portal: ToastPortal,
  Positioner: ToastPositioner,
  Arrow: ToastArrow,
  createToastManager,
  useToastManager,
};
export type ToastProvider = typeof Toast.Provider;
export type ToastViewport = typeof Toast.Viewport;
export type ToastRoot = typeof Toast.Root;
export type ToastContent = typeof Toast.Content;
export type ToastDescription = typeof Toast.Description;
export type ToastTitle = typeof Toast.Title;
export type ToastClose = typeof Toast.Close;
export type ToastAction = typeof Toast.Action;
export type ToastPortal = typeof Toast.Portal;
export type ToastPositioner = typeof Toast.Positioner;
export type ToastArrow = typeof Toast.Arrow;
export namespace Toast {
  export type Object<Data extends object = Record<string, unknown>> = ToastObject<Data>;
}
