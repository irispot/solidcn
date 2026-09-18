import {
  createContext,
  createSignal,
  useContext,
  createUniqueId,
  createEffect,
  sharedConfig,
  Show,
  untrack,
  $PROXY,
} from 'solid-js';
import { Dynamic, isServer, type JSX } from '@solidjs/web';

export type Ref<T> = ((element: T) => void) | { current: T | null } | undefined;
export type State = Record<string, unknown>;
/** Polymorphic props are forwarded to the selected native element. */
export type BaseProps<S = State> = {
  children?: JSX.Element;
  render?: ((props: Record<string, unknown>, state: S) => JSX.Element) | JSX.Element;
  class?: string | ((state: S) => string | undefined);
  className?: string | ((state: S) => string | undefined);
  style?: JSX.CSSProperties | string | false | null | ((state: S) => JSX.CSSProperties | undefined);
  side?: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  ref?: Ref<any>;
  [key: string]: any;
};
export interface ChangeEventDetails {
  event: Event;
  reason: string;
  cancel: () => void;
  allowPropagation: () => void;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
}
export function eventDetails(event?: Event, reason = 'none'): ChangeEventDetails {
  const details: ChangeEventDetails = {
    event: event ?? new Event('base-ui'),
    reason,
    isCanceled: false,
    isPropagationAllowed: false,
    cancel() {
      details.isCanceled = true;
    },
    allowPropagation() {
      details.isPropagationAllowed = true;
    },
  };
  return details;
}
export function createControllable<T>(
  props: BaseProps<any>,
  key: string,
  initial: T,
): [() => T, (value: T, event?: Event, reason?: string) => boolean] {
  const upper = key.charAt(0).toUpperCase() + key.slice(1);
  const defaultValue = untrack(() => (props[`default${upper}`] ?? initial) as T);
  const [value, setValue] = createSignal<T>(() => defaultValue);
  const read = () => (props[key] !== undefined ? (props[key] as T) : value());
  return [
    read,
    (next, event, reason) => {
      if (Object.is(read(), next)) return false;
      const details = eventDetails(event, reason);
      props[`on${upper}Change`]?.(next, details);
      if (details.isCanceled) return false;
      if (props[key] === undefined) setValue(() => next);
      return true;
    },
  ];
}
export function assignRef<T>(ref: Ref<T> | Ref<T>[], value: T) {
  if (Array.isArray(ref)) ref.forEach((item) => assignRef(item, value));
  else if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
const getValue = (source: Record<string, any> | (() => Record<string, any>)) =>
  typeof source === 'function' ? source() : source;
/** Merge without taking a snapshot of reactive getters. User handlers run first. */
export function mergeProps<T extends Record<string, any>>(
  ...sources: (T | Record<string, any> | (() => Record<string, any>))[]
): T {
  const proxy: T = new Proxy({} as T, {
    ownKeys: () => [...new Set(sources.flatMap((source) => Reflect.ownKeys(getValue(source))))],
    getOwnPropertyDescriptor: (_, key) => ({
      configurable: true,
      enumerable: true,
      get: () => proxy[key as keyof T],
    }),
    has: (_, key) => sources.some((source) => key in getValue(source)),
    get: (_, key: string | symbol) => {
      if (typeof key !== 'string') return undefined;
      const values = sources
        .map((source) => getValue(source)[key])
        .filter((value) => value !== undefined);
      if (values.length === 0) return undefined;
      if (key === 'class' || key === 'className') return values.filter(Boolean).join(' ');
      if (key === 'style' && values.every((value) => typeof value === 'object'))
        return Object.assign({}, ...values);
      if (key === 'ref')
        return (element: Element) => values.forEach((ref) => assignRef(ref, element));
      if (
        /^on[A-Z]/.test(key) &&
        values.some((value) => typeof value === 'function' || Array.isArray(value))
      )
        return (event: Event) => {
          if (event && typeof event === 'object' && !('preventBaseUIHandler' in event)) {
            Object.assign(event, {
              baseUIHandlerPrevented: false,
              preventBaseUIHandler() {
                (event as Event & { baseUIHandlerPrevented: boolean }).baseUIHandlerPrevented =
                  true;
              },
            });
          }
          for (const handler of values.toReversed()) {
            if (typeof handler === 'function') handler(event);
            else if (Array.isArray(handler)) handler[0](handler[1], event);
            if (
              event.defaultPrevented ||
              (event as Event & { baseUIHandlerPrevented?: boolean }).baseUIHandlerPrevented
            )
              break;
          }
        };
      return values.at(-1);
    },
  });
  return proxy;
}
const privateProps = new Set([
  'render',
  'nativeButton',
  'className',
  'defaultOpen',
  'defaultValue',
  'defaultChecked',
  'defaultPressed',
  'onOpenChange',
  'onOpenChangeComplete',
  'onValueChange',
  'onValueCommitted',
  'onCheckedChange',
  'onPressedChange',
  'onInputValueChange',
  'onSelectedChange',
  'actionsRef',
  'handle',
  'payload',
  'keepMounted',
  'forceMount',
  'state',
  'stateAttributesMapping',
  'defaultTagName',
  'enabled',
  'modal',
  'initialFocus',
  'finalFocus',
  'loopFocus',
  'orientation',
  'activationMode',
  'delay',
  'closeDelay',
  'disablePointerDismissal',
  'side',
  'align',
  'sideOffset',
  'alignOffset',
  'anchor',
  'collisionPadding',
  'collisionBoundary',
  'collisionAvoidance',
  'positionMethod',
  'sticky',
  'arrowPadding',
  'trackAnchor',
  'onPositioned',
  'onItemHighlighted',
  'itemToStringLabel',
  'itemToStringValue',
  'isItemEqualToValue',
]);
export function omitProps<T extends Record<string, any>>(props: T, keys: readonly string[]): T {
  const omitted = new Set(keys);
  return new Proxy(props, {
    ownKeys: (target) => Reflect.ownKeys(target).filter((key) => !omitted.has(String(key))),
    getOwnPropertyDescriptor: (target, key) =>
      omitted.has(String(key))
        ? undefined
        : { configurable: true, enumerable: true, get: () => Reflect.get(target, key) },
    get: (target, key) => (omitted.has(String(key)) ? undefined : Reflect.get(target, key)),
    has: (target, key) => !omitted.has(String(key)) && key in target,
  });
}
export function renderElement<S extends object = State>(
  tag: keyof JSX.IntrinsicElements,
  props: BaseProps<S>,
  state: S = {} as S,
  defaults: Record<string, any> = {},
): JSX.Element {
  const attributes: Record<string, unknown> = new Proxy(
    {},
    {
      ownKeys: () => [
        ...new Set(
          Object.keys(state).flatMap((key) => {
            const keys = [
              `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
              `data-${key.toLowerCase()}`,
            ];
            if (key === 'orientation') keys.push('data-horizontal', 'data-vertical');
            if (key === 'checked') keys.push('data-unchecked');
            if (key === 'pressed') keys.push('data-unpressed');
            if (key === 'open') keys.push('data-closed');
            if (key === 'valid') keys.push('data-invalid');
            return keys;
          }),
        ),
      ],
      getOwnPropertyDescriptor: (_, key) => ({
        configurable: true,
        enumerable: true,
        get: () => attributes[String(key)],
      }),
      has: (_, key) => typeof key === 'string' && Reflect.ownKeys(attributes).includes(key),
      get: (_, key: string | symbol) => {
        if (typeof key !== 'string' || !key.startsWith('data-')) return undefined;
        if (key === 'data-horizontal' || key === 'data-vertical')
          return (state as State).orientation === key.slice(5) ? '' : undefined;
        if (key === 'data-unchecked') return (state as State).checked === false ? '' : undefined;
        if (key === 'data-unpressed') return (state as State).pressed === false ? '' : undefined;
        if (key === 'data-closed' && 'open' in state)
          return (state as State).open === false ? '' : undefined;
        if (key === 'data-invalid' && 'valid' in state)
          return (state as State).valid === false ? '' : undefined;
        const stateKey = key
          .slice(5)
          .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        const actualKey =
          stateKey in state
            ? stateKey
            : Object.keys(state).find((candidate) => candidate.toLowerCase() === stateKey);
        const value = actualKey ? (state as State)[actualKey] : undefined;
        return value === true
          ? ''
          : value === false || value == null || typeof value === 'object'
            ? undefined
            : String(value);
      },
    },
  );
  const incoming = new Proxy(props, {
    ownKeys: (target) =>
      Reflect.ownKeys(target).filter(
        (key) => !privateProps.has(String(key)) && key !== 'class' && key !== 'style',
      ),
    getOwnPropertyDescriptor: (target, key) =>
      privateProps.has(String(key))
        ? undefined
        : { configurable: true, enumerable: true, get: () => Reflect.get(target, key) },
    get: (target, key) =>
      privateProps.has(String(key)) || key === 'class' || key === 'style'
        ? undefined
        : Reflect.get(target, key),
  });
  const combined: Record<string, any> = mergeProps(attributes, defaults, incoming, {
    get class() {
      const value = props.class ?? props.className;
      return typeof value === 'function' ? value(state) : value;
    },
    get style() {
      return typeof props.style === 'function' ? props.style(state) : props.style;
    },
  });
  const merged: Record<string, any> = new Proxy(combined, {
    get: (target, key) => {
      const value = Reflect.get(target, key);
      return typeof key === 'string' && key.startsWith('aria-') && typeof value === 'boolean'
        ? String(value)
        : value;
    },
    getOwnPropertyDescriptor: (target, key) => ({
      configurable: true,
      enumerable: true,
      get: () => merged[String(key)],
    }),
  });
  // The render function selects the element at mount time. Its merged props
  // remain reactive, but reading the function itself is an initial read.
  const render = untrack(() => props.render);
  if (typeof render === 'function') return render(merged, state);
  if (render != null) {
    throw new Error(
      'Base UI: The render prop requires a function in Solid. An element cannot receive merged props. Use render={(props) => <a {...props} />}. See https://base-ui.com/react/utils/use-render.',
    );
  }
  return <Dynamic component={tag} {...merged} />;
}
export type StateAttributesMapping<S> = {
  [K in keyof S]?: (value: S[K]) => Record<string, string> | null;
};
export type UseRenderRenderProp<S = State> = (props: Record<string, any>, state: S) => JSX.Element;
export type UseRenderElementProps<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];
export type UseRenderComponentProps<
  T extends keyof JSX.IntrinsicElements,
  S = State,
  P = Record<string, any>,
> = Omit<JSX.IntrinsicElements[T], 'class' | 'style'> & {
  render?: (props: P, state: S) => JSX.Element;
  class?: string | ((state: S) => string | undefined);
  className?: string | ((state: S) => string | undefined);
  style?: JSX.CSSProperties | string | ((state: S) => JSX.CSSProperties | undefined);
};
export interface UseRenderParameters<S, E extends Element, Enabled extends boolean | undefined> {
  defaultTagName?: keyof JSX.IntrinsicElements;
  render?: UseRenderRenderProp<S>;
  props?: Record<string, any>;
  state?: S;
  ref?: Ref<E> | Ref<E>[];
  enabled?: Enabled;
  stateAttributesMapping?: StateAttributesMapping<S>;
}
export type UseRenderReturnValue<Enabled extends boolean | undefined> = Enabled extends false
  ? null
  : JSX.Element;
export interface UseRenderState {}

/** Public state mappings follow upstream rules, without private component flags. */
export function useRender<
  S extends object = State,
  E extends Element = Element,
  Enabled extends boolean | undefined = undefined,
>(options: UseRenderParameters<S, E, Enabled>): UseRenderReturnValue<Enabled> {
  const state = new Proxy({} as S, {
    ownKeys: () => Reflect.ownKeys(options.state ?? {}),
    has: (_, key) => Reflect.has(options.state ?? {}, key),
    get: (_, key) => Reflect.get(options.state ?? {}, key),
    getOwnPropertyDescriptor: (_, key) => ({
      configurable: true,
      enumerable: true,
      get: () => Reflect.get(options.state ?? {}, key),
    }),
  });
  const stateAttributes = () => {
    const attributes: Record<string, string> = {};
    for (const key in options.state ?? {}) {
      const value = state[key as keyof S];
      const mapping = options.stateAttributesMapping;
      if (mapping && Object.hasOwn(mapping, key)) {
        Object.assign(attributes, mapping[key as keyof S]?.(value));
      } else if (value === true) attributes[`data-${key.toLowerCase()}`] = '';
      else if (value) attributes[`data-${key.toLowerCase()}`] = String(value);
    }
    return attributes;
  };
  const props = mergeProps<Record<string, any>>(
    stateAttributes,
    () => omitProps(options.props ?? {}, ['className', 'class', 'style']),
    {
      get class() {
        const value = options.props?.class ?? options.props?.className;
        return typeof value === 'function' ? value(state) : value;
      },
      get style() {
        const value = options.props?.style;
        return typeof value === 'function' ? value(state) : value;
      },
      get ref() {
        return options.ref;
      },
    },
  );
  const normalized: Record<string, any> = new Proxy(props, {
    has: (target, key) => key === $PROXY || Reflect.has(target, key),
    get: (target, key) => {
      if (key === $PROXY) return normalized;
      if (key === 'className') return target.class;
      const value = Reflect.get(target, key);
      return typeof key === 'string' && key.startsWith('aria-') && typeof value === 'boolean'
        ? String(value)
        : value;
    },
    getOwnPropertyDescriptor: (_, key) => ({
      configurable: true,
      enumerable: true,
      get: () => normalized[String(key)],
    }),
  });
  return (() => {
    if (options.enabled === false) return null;
    // State changes update attributes. They must not replace the element or its children.
    return untrack(() => {
      if (typeof options.render === 'function') return options.render(normalized, state);
      if (options.render != null) throw new Error('Base UI: Solid render props must be functions.');
      return <Dynamic component={options.defaultTagName ?? 'div'} {...normalized} />;
    });
  }) as UseRenderReturnValue<Enabled>;
}
export namespace useRender {
  export type State = UseRenderState;
  export type ComponentProps<
    T extends keyof JSX.IntrinsicElements,
    S = Record<string, unknown>,
    P = Record<string, any>,
  > = UseRenderComponentProps<T, S, P>;
  export type RenderProp<S = Record<string, unknown>> = UseRenderRenderProp<S>;
  export type ElementProps<T extends keyof JSX.IntrinsicElements> = UseRenderElementProps<T>;
  export type Parameters<
    S,
    E extends Element,
    Enabled extends boolean | undefined = undefined,
  > = UseRenderParameters<S, E, Enabled>;
  export type ReturnValue<Enabled extends boolean | undefined> = UseRenderReturnValue<Enabled>;
}
export type TextDirection = 'ltr' | 'rtl';
export interface DirectionProviderProps {
  children?: JSX.Element;
  direction?: TextDirection | undefined;
}
export interface DirectionProviderState {}
export const DirectionContext = createContext<() => TextDirection>(() => 'ltr');
export function DirectionProvider(props: DirectionProviderProps) {
  return <DirectionContext value={() => props.direction ?? 'ltr'}>{props.children}</DirectionContext>;
}
export namespace DirectionProvider {
  export type Props = DirectionProviderProps;
  export type State = DirectionProviderState;
}
export const useDirection = () => useContext(DirectionContext);
interface CSPContextValue {
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}
export const CSPContext = createContext<() => CSPContextValue>(() => ({
  disableStyleElements: false,
}));
export interface CSPProviderState {}
export interface CSPProviderProps {
  children?: JSX.Element;
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}
export function CSPProvider(props: CSPProviderProps) {
  return (
    <CSPContext
      value={() => ({ nonce: props.nonce, disableStyleElements: props.disableStyleElements })}
    >
      {props.children}
    </CSPContext>
  );
}
export namespace CSPProvider {
  export type Props = CSPProviderProps;
  export type State = CSPProviderState;
}
export type CSPProvider = typeof CSPProvider;
/** Shared inline style used by Scroll Area and Select. */
export function ScrollbarStyle() {
  const csp = useContext(CSPContext);
  return (
    <Show when={!csp().disableStyleElements}>
      <style nonce={csp().nonce}>
        {'.base-ui-disable-scrollbar{scrollbar-width:none}.base-ui-disable-scrollbar::-webkit-scrollbar{display:none}'}
      </style>
    </Show>
  );
}
export function useId(props: BaseProps, suffix = '') {
  const id = createUniqueId();
  return () => props.id ?? `${id}${suffix}`;
}
export function activeElement(node: Node): Element | null {
  let element = node.ownerDocument?.activeElement ?? null;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}
export function contains(parent: Node | null | undefined, child: Node | null): boolean {
  if (!parent || !child) return false;
  for (
    let node: Node | null = child;
    node;
    node = node.parentNode ?? (node.getRootNode() as ShadowRoot).host ?? null
  )
    if (node === parent) return true;
  return false;
}
export function getTarget(event: Event): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}
export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.tabIndex >= 0 &&
      !element.closest('[hidden],[inert],[aria-hidden="true"]'),
  );
}
export function useTimeout() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  // This is the Solid equivalent of the upstream React-owned timer utility.
  createEffect(
    () => true,
    () => clear,
  );
  return {
    start(delay: number, callback: () => void) {
      clear();
      timer = setTimeout(callback, delay);
    },
    clear,
    isStarted: () => timer !== undefined,
  };
}
export function useAnimationFrame() {
  let frame: number | undefined;
  const clear = () => {
    if (frame !== undefined && typeof cancelAnimationFrame !== 'undefined')
      cancelAnimationFrame(frame);
    frame = undefined;
  };
  createEffect(
    () => true,
    () => clear,
  );
  return {
    request(callback: FrameRequestCallback) {
      clear();
      frame = requestAnimationFrame(callback);
    },
    cancel: clear,
  };
}
export interface UseMediaQueryOptions {
  defaultMatches?: boolean;
  matchMedia?: typeof window.matchMedia;
  noSsr?: boolean;
  ssrMatchMedia?: (query: string) => { matches: boolean };
}
export interface UseMediaQueryState {}
export function useMediaQuery(query: string, options: UseMediaQueryOptions = {}) {
  const normalizedQuery = query.replace(/^@media( ?)/m, '');
  const defaultMatches = options.defaultMatches ?? false;
  const matchMedia = options.matchMedia ??
    (typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined'
      ? window.matchMedia.bind(window)
      : null);
  const serverSnapshot = () =>
    options.ssrMatchMedia?.(normalizedQuery).matches ?? defaultMatches;
  const firstMatch = options.noSsr && matchMedia
    ? matchMedia(normalizedQuery).matches
    : isServer || sharedConfig.hydrating
      ? serverSnapshot()
      : matchMedia?.(normalizedQuery).matches ?? defaultMatches;
  const [matches, setMatches] = createSignal(firstMatch);
  createEffect(() => normalizedQuery, () => {
    if (isServer || !matchMedia) return;
    const media = matchMedia(normalizedQuery);
    const listener = () => setMatches(media.matches);
    listener();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  });
  return matches;
}
export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}

const documentScrollLocks = new WeakMap<Document, { count: number; restore: () => void }>();
/** Shared document lock. Nested dialogs and selections release only their own lock. */
export function acquireScrollLock(document: Document): () => void {
  let lock = documentScrollLocks.get(document);
  if (!lock) {
    const body = document.body;
    const root = document.documentElement;
    const ownerWindow = document.defaultView;
    const saved = [
      { element: body, property: 'overflow' },
      { element: body, property: 'padding-right' },
      { element: root, property: 'overflow' },
    ].map(({ element, property }) => ({
      element,
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    }));
    const gutter =
      ownerWindow && root.clientWidth ? Math.max(0, ownerWindow.innerWidth - root.clientWidth) : 0;
    const padding = ownerWindow
      ? Number.parseFloat(ownerWindow.getComputedStyle(body).paddingRight) || 0
      : 0;
    body.style.setProperty('overflow', 'hidden');
    root.style.setProperty('overflow', 'hidden');
    if (gutter) body.style.setProperty('padding-right', `${padding + gutter}px`);
    lock = {
      count: 0,
      restore() {
        for (const { element, property, value, priority } of saved) {
          if (value) element.style.setProperty(property, value, priority);
          else element.style.removeProperty(property);
        }
      },
    };
    documentScrollLocks.set(document, lock);
  }
  lock.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count === 0) {
      lock.restore();
      documentScrollLocks.delete(document);
    }
  };
}
