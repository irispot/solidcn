/** Framework fixture transport only. This file does not implement UI components. */
import { createContext, createSignal, onCleanup, useContext as solidUseContext } from 'solid-js';

// An unchanged React context probe can read the native Solid context in its owner.
export const useContext = solidUseContext;

interface FixtureHost {
  hooks: any[];
  cursor: number;
  invalidate: () => void;
  disposed: boolean;
}
let activeHost: FixtureHost | undefined;

export function createFixtureHost(component: (props: any) => any) {
  const [revision, setRevision] = createSignal(0);
  const host: FixtureHost = {
    hooks: [],
    cursor: 0,
    invalidate: () => setRevision((value) => value + 1),
    disposed: false,
  };
  onCleanup(() => {
    host.disposed = true;
    for (const hook of host.hooks) hook.cleanup?.();
  });
  return (props: Record<string, any>) => {
    revision();
    host.cursor = 0;
    const previous = activeHost;
    activeHost = host;
    try {
      return component(props);
    } finally {
      activeHost = previous;
    }
  };
}

function hookSlot(kind: string, create: () => Record<string, any>) {
  if (!activeHost) throw new Error(`Fixture ${kind} requires a fixture component owner.`);
  const index = activeHost.cursor++;
  const hook = (activeHost.hooks[index] ??= { kind, ...create() });
  if (hook.kind !== kind)
    throw new Error('Fixture hook order changed. The adapter does not support this lifecycle.');
  return hook;
}
export const Fragment = Symbol.for('solid-cn.parity.fragment');
export const StrictMode = Symbol.for('solid-cn.parity.strict-mode');
export const Suspense = Symbol.for('solid-cn.parity.suspense');
export const FixtureSuspenseContext = createContext<{
  register(promise: Promise<unknown>): void;
} | null>(null);
// The original animation test records DOM counts after a commit. This fixture
// adapter keeps that observation point without supplying any UI behavior.
export function Profiler(props: { children: unknown; onRender?: () => void }) {
  // Observe the committed subtree after each DOM batch, including commits
  // made by a native child without a fixture parent render.
  const observer = new MutationObserver(() => props.onRender?.());
  let disposed = false;
  queueMicrotask(() => {
    if (disposed) return;
    observer.observe(document.body, { childList: true, subtree: true });
    props.onRender?.();
  });
  onCleanup(() => {
    disposed = true;
    observer.disconnect();
  });
  return props.children;
}
const descriptor = Symbol.for('solid-cn.parity.descriptor');
export interface FixtureElement {
  readonly $$typeof: symbol;
  readonly type: string | symbol | ((props: any) => any);
  readonly props: Record<string, any>;
  readonly key?: string;
}
export function jsx(
  type: FixtureElement['type'],
  props: Record<string, any> | null,
  key?: string,
): FixtureElement {
  return { $$typeof: descriptor, type, props: props ?? {}, key };
}
export const jsxs = jsx;
export const jsxDEV = jsx;
export function isValidElement(value: unknown): value is FixtureElement {
  return Boolean(
    value && typeof value === 'object' && '$$typeof' in value && value.$$typeof === descriptor,
  );
}
export function createElement(
  type: FixtureElement['type'],
  props: Record<string, any> | null,
  ...children: any[]
) {
  return jsx(type, {
    ...props,
    ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}),
  });
}
export function cloneElement(
  element: FixtureElement,
  props?: Record<string, any> | null,
  ...children: any[]
) {
  if (!isValidElement(element))
    throw new Error('The parity fixture adapter expected a JSX descriptor.');
  return jsx(
    element.type,
    {
      ...element.props,
      ...props,
      ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}),
    },
    element.key,
  );
}
export function createRef<T = unknown>() {
  return { current: null as T | null };
}
export function forwardRef<T, Props>(component: (props: Props, ref: any) => any) {
  return (props: Props & { ref?: any }) => component(props, props.ref);
}
export const version = 'fixture-adapter-no-react-runtime';
function unsupported(name: string): never {
  throw new Error(
    `The narrow parity fixture adapter does not implement React.${name}. This suite needs an explicit fixture lifecycle adapter.`,
  );
}
export function useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
  const host = activeHost;
  const hook = hookSlot('useState', () => ({
    value: typeof initial === 'function' ? (initial as () => T)() : initial,
  }));
  hook.set ??= (next: T | ((previous: T) => T)) => {
    const value = typeof next === 'function' ? (next as (previous: T) => T)(hook.value) : next;
    if (!Object.is(value, hook.value) && !host!.disposed) {
      hook.value = value;
      host!.invalidate();
    }
  };
  return [hook.value, hook.set];
}
export function useEffect(callback: () => void | (() => void), dependencies?: readonly unknown[]) {
  const host = activeHost;
  const hook = hookSlot('useEffect', () => ({ dependencies: undefined, initialized: false }));
  const changed =
    !hook.initialized ||
    !dependencies ||
    dependencies.length !== hook.dependencies?.length ||
    dependencies.some((value, index) => !Object.is(value, hook.dependencies[index]));
  if (!changed) return;
  hook.initialized = true;
  hook.dependencies = dependencies;
  queueMicrotask(() => {
    if (!host!.disposed) {
      hook.cleanup?.();
      hook.cleanup = callback();
    }
  });
}
export const useLayoutEffect = (..._arguments: unknown[]): never => unsupported('useLayoutEffect');
export function useRef<T>(initial: T) {
  return hookSlot('useRef', () => ({ ref: { current: initial } })).ref as { current: T };
}
export const useMemo = (..._arguments: unknown[]): never => unsupported('useMemo');
export const useCallback = (..._arguments: unknown[]): never => unsupported('useCallback');
export function use<T>(promise: Promise<T>): T {
  const host = activeHost;
  const boundary = useContext(FixtureSuspenseContext);
  const hook = hookSlot('use', () => ({ promise, status: 'pending', value: undefined }));
  if (hook.promise !== promise) {
    hook.promise = promise;
    hook.status = 'pending';
    hook.value = undefined;
    hook.subscribed = false;
  }
  if (!hook.subscribed) {
    hook.subscribed = true;
    promise.then(
      (value) => {
        hook.value = value;
        hook.status = 'resolved';
        if (!host!.disposed) host!.invalidate();
      },
      (error) => {
        hook.value = error;
        hook.status = 'rejected';
        if (!host!.disposed) host!.invalidate();
      },
    );
  }
  if (hook.status === 'rejected') throw hook.value;
  if (hook.status === 'pending') boundary?.register(promise);
  return hook.value as T;
}
