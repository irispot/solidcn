import {
  createEffect,
  createErrorBoundary,
  createMemo,
  createRoot,
  createSignal,
  flush,
  For,
  getOwner,
  onCleanup,
  runWithOwner,
  sharedConfig,
  Show,
  untrack,
} from "solid-js";
import {
  createComponent,
  Dynamic,
  isServer,
  hydrate,
  render,
  renderToString as solidRenderToString,
} from "@solidjs/web";
import { afterAll, afterEach, describe, expect } from "vitest";
import {
  fireEvent as domFireEvent,
  getQueriesForElement,
  queries,
} from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { assignRef, mergeProps } from "../../base-ui/packages/solid/src/core";
import {
  Fragment,
  StrictMode,
  Suspense,
  FixtureSuspenseContext,
  isValidElement,
  createFixtureHost,
  type FixtureElement,
} from "./fixture-runtime";

export { screen, waitFor, within } from "@testing-library/dom";
// React Testing Library commits synchronous updates before fireEvent returns.
// Give the native fixture bridge that same boundary without changing assertions.
const wrappedEvents = new Map<PropertyKey, Function>();
export const fireEvent = new Proxy(domFireEvent, {
  apply(target, receiver, args) {
    const result = Reflect.apply(target, receiver, args);
    flush();
    return result;
  },
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== "function" || !Object.hasOwn(target, key))
      return value;
    if (!wrappedEvents.has(key))
      wrappedEvents.set(key, (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args);
        flush();
        return result;
      });
    return wrappedEvents.get(key);
  },
});
const native = new WeakMap<Function, string>();
let nativeOverride: ((component: Function) => Function | undefined) | undefined;
const nativeExecutions = new Map<string, number>();
const nativeExecutionsInCase = new Map<string, number>();
const mounted = new Set<{ dispose: () => void; container: HTMLElement }>();
const serverMounted = new Set<HTMLElement>();
let rendersInCase = 0;
let nativeCallsInCase = 0;

export function registerNative<T extends Function>(
  component: T,
  source: string,
): T {
  native.set(component, source);
  return component;
}

export function nativeSource(component: Function): string | undefined {
  return native.get(component);
}

export function setNativeOverride(
  override: ((component: Function) => Function | undefined) | undefined,
) {
  nativeOverride = override;
}

export function recordNativeExecution(source: string) {
  nativeCallsInCase++;
  nativeExecutions.set(source, (nativeExecutions.get(source) ?? 0) + 1);
  nativeExecutionsInCase.set(source, (nativeExecutionsInCase.get(source) ?? 0) + 1);
}

export function adaptRenderProp(renderProp: any) {
  if (isValidElement(renderProp)) {
    return (merged: Record<string, any>) =>
      materialize({
        ...renderProp,
        props: mergeProps(merged, domProps(renderProp.props)),
      });
  }
  if (typeof renderProp === "function")
    return (merged: Record<string, any>, state: unknown) =>
      // Keep reactive reads in the returned node's owner. Reading position
      // here also tracks the parent's Show and remounts the Positioner.
      materializeReactive(() => renderProp(merged, state));
  return renderProp;
}

// React adds px to numeric CSS lengths. Solid sends numbers to setProperty as-is.
// This adapter keeps unchanged React fixtures equal at the DOM style boundary.
const reactUnitlessStyles = new Set(
  'animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp'.split(' '),
);
function reactStyle(style: unknown): unknown {
  if (typeof style === 'function')
    return (state: unknown) => reactStyle(style(state));
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  return Object.fromEntries(Object.entries(style).map(([name, value]) => {
    const cssName = name.startsWith('--')
      ? name
      : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, '-ms-');
    const cssValue = typeof value === 'number' && value !== 0 &&
      !name.startsWith('--') && !reactUnitlessStyles.has(name)
      ? `${value}px` : value;
    return [cssName, cssValue];
  }));
}

function domProps(props: Record<string, any>, excludeCaptures = false) {
  const proxy = new Proxy(props, {
    ownKeys: (target) => [
      ...new Set(
        Reflect.ownKeys(target)
          .filter(
            (key) =>
              key !== "key" &&
              !(
                excludeCaptures &&
                typeof key === "string" &&
                /^on[A-Z].*Capture$/.test(key)
              ),
          )
          .map((key) =>
            key === "className" ? "class"
              : key === "htmlFor" ? "for"
              : key === "dangerouslySetInnerHTML" ? "innerHTML"
              : key,
          ),
      ),
    ],
    getOwnPropertyDescriptor: (_target, key) => ({
      configurable: true,
      enumerable: true,
      get: () => proxy[key],
    }),
    get: (target, key) =>
      key === "class"
        ? (target.class ?? target.className)
        : key === "for"
          ? (target.for ?? target.htmlFor)
          : key === "innerHTML"
            ? target.innerHTML ?? target.dangerouslySetInnerHTML?.__html
          : Reflect.get(target, key),
  });
  return proxy;
}

function propsForNative(props: Record<string, any>, intrinsic: boolean) {
  const source = intrinsic ? domProps(props, true) : props;
  let renderSourceKey: unknown = Symbol('uninitialized-render');
  let renderAdapter: ((merged: Record<string, any>, state?: unknown) => any) | undefined;
  const adaptedRender = intrinsic ? undefined : createMemo(() => {
    const original = source.render;
    const sourceKey = isValidElement(original) ? original.type : original;
    if (Object.is(sourceKey, renderSourceKey)) return renderAdapter;
    renderSourceKey = sourceKey;
    renderAdapter = isValidElement(original)
      ? (merged) => materializeReactive(() => {
          const current = source.render;
          return isValidElement(current)
            ? { ...current, props: mergeProps(merged, domProps(current.props)) }
            : undefined;
        })
      : adaptRenderProp(original);
    return renderAdapter;
  });
  const hasNativeRef = !intrinsic && 'ref' in props;
  let currentRef = hasNativeRef ? untrack(() => props.ref) : undefined;
  let currentElement: Element | null = null;
  const attachNativeRef = (element: Element | null) => {
    if (currentElement === element) return;
    if (currentElement) assignRef(currentRef, null);
    currentElement = element;
    if (element) assignRef(currentRef, element);
  };
  if (hasNativeRef) {
    createEffect(
      () => props.ref,
      (nextRef) => {
        if (nextRef === currentRef) return;
        if (currentElement) assignRef(currentRef, null);
        currentRef = nextRef;
        if (currentElement) assignRef(currentRef, currentElement);
      },
    );
  }
  // A native provider must own its children before they are materialized.
  // Creating the child memo here runs it outside that provider's context.
  let content: (() => any) | undefined;
  let disposeContent: (() => void) | undefined;
  const captureCleanup: (() => void)[] = [];
  onCleanup(() => {
    if (currentElement) assignRef(currentRef, null);
    currentElement = null;
    disposeContent?.();
    for (const cleanup of captureCleanup) cleanup();
  });
  const attachRef = (element: Element) => {
    assignRef(props.ref, element);
    for (const key of Object.keys(props)) {
      if (!/^on[A-Z].*Capture$/.test(key)) continue;
      const eventName = key.slice(2, -7).toLowerCase();
      const callback = (event: Event) => props[key]?.(event);
      element.addEventListener(eventName, callback, true);
      captureCleanup.push(() =>
        element.removeEventListener(eventName, callback, true),
      );
    }
  };
  return new Proxy(source, {
    ownKeys: (target) => [
      ...new Set([...Reflect.ownKeys(target), ...(intrinsic ? ["ref"] : [])]),
    ],
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    get(target, key) {
      if (key === "children") {
        // The first read is usually inside a DOM update effect. That effect
        // can dispose child owners while a retained fixture descriptor still
        // refers to them. Keep the child scope under the provider owner that
        // supplied the current context, not under the transient DOM effect.
        if (!content) {
          let stableOwner = getOwner();
          if (!isServer && !sharedConfig.hydrating)
            while (stableOwner?._parent && stableOwner._parent._context === stableOwner._context)
              stableOwner = stableOwner._parent;
          content = runWithOwner(stableOwner, () => createRoot((dispose) => {
            disposeContent = dispose;
            return materializeReactive(() => source.children);
          }));
        }
        return content();
      }
      if (key === "ref" && intrinsic) return attachRef;
      if (key === "ref") return hasNativeRef ? attachNativeRef : undefined;
      if (key === "render" && !intrinsic) {
        return adaptedRender?.();
      }
      if (key === 'style') return reactStyle(Reflect.get(target, key));
      if (key === "onSubmit" && typeof Reflect.get(target, key) === "function") {
        return (event: SubmitEvent) => {
          // Unchanged React assertions inspect the synthetic event's nativeEvent.
          // The shipped Solid component still receives and emits a native event.
          if (!("nativeEvent" in event))
            Object.defineProperty(event, "nativeEvent", { value: event });
          return Reflect.get(target, key)(event);
        };
      }
      return Reflect.get(target, key);
    },
  });
}

function materialize(value: any): any {
  return materializeReactive(() => value);
}

export function assertFixturePropKeys(previous: any, next: any) {
  if (
    !isValidElement(previous) ||
    !isValidElement(next) ||
    previous.type !== next.type
  )
    return;
  const oldKeys = Reflect.ownKeys(previous.props);
  const newKeys = Reflect.ownKeys(next.props);
  if (
    oldKeys.length !== newKeys.length ||
    oldKeys.some((key) => !newKeys.includes(key))
  )
    throw new Error(
      "The fixture adapter does not yet support adding or removing prop keys on a retained component.",
    );
}

const arrayKind = Symbol("fixture-array");
function materializeReactive(read: () => any): () => any {
  // Compare the component type, not the descriptor object. Same-type native
  // components keep their owner and DOM; fixture updates change reactive props.
  const kind = createMemo(() => {
    const value = read();
    return Array.isArray(value)
      ? arrayKind
      : isValidElement(value)
        ? value.type
        : value;
  });
  return createMemo(() => {
    const type = kind();
    const value = untrack(read);
    if (Array.isArray(value)) {
      // React keeps a keyed child's owner when its position changes. Stable
      // holders give Solid's keyed map the same identity. Children without an
      // explicit key retain their position-based identity.
      const holders = new Map<string, { identity: string }>();
      const identity = (item: any, index: number) =>
        isValidElement(item) && item.key != null
          ? `key:${item.key}`
          : `index:${index}`;
      return createComponent(For, {
        get each() {
          const values = read();
          if (!Array.isArray(values)) return [];
          const active = new Set<string>();
          const next = values.map((item, index) => {
            const key = identity(item, index);
            active.add(key);
            let holder = holders.get(key);
            if (!holder) {
              holder = { identity: key };
              holders.set(key, holder);
            }
            return holder;
          });
          for (const key of holders.keys())
            if (!active.has(key)) holders.delete(key);
          return next;
        },
        keyed: true,
        children: (holder: { identity: string }) =>
          materializeReactive(() => {
            const values = read();
            return Array.isArray(values)
              ? values.find((item, index) => identity(item, index) === holder.identity)
              : undefined;
          }),
      });
    }
    if (!isValidElement(value)) return value;
    const propertyValues = new Map<PropertyKey, () => any>();
    // Each prop has a tracking scope. Reading an absent/setup-only prop must
    // not snapshot the complete fixture descriptor inside a Solid component.
    for (const key of Reflect.ownKeys(value.props)) {
      const property = () => {
        const next = read();
        return isValidElement(next) ? Reflect.get(next.props, key) : undefined;
      };
      // Reading merged render-prop children can create native descendants.
      // Delay that read until the new component's provider is active.
      propertyValues.set(
        key,
        key === "children" ? property : createMemo(property),
      );
    }
    const props = new Proxy(
      {},
      {
        ownKeys: () => untrack(() => {
          const next = read();
          return isValidElement(next) ? Reflect.ownKeys(next.props) : [];
        }),
        has: (_, key) => untrack(() => {
          const next = read();
          return isValidElement(next) && Reflect.has(next.props, key);
        }),
        get: (_, key) => {
          let property = propertyValues.get(key);
          if (!property) {
            const readProperty = () => {
              const next = read();
              return isValidElement(next) ? Reflect.get(next.props, key) : undefined;
            };
            // A prop can be added after mount. Read the current descriptor in
            // the consumer's tracking scope so that its first absent read does
            // not freeze a newly added optional prop at undefined.
            property = readProperty;
            propertyValues.set(key, property);
          }
          return property();
        },
        getOwnPropertyDescriptor: () => ({
          configurable: true,
          enumerable: true,
        }),
      },
    );
    if (type === Fragment) return materializeReactive(() => props.children);
    if (type === Suspense) {
      const pendingPromises = new Set<Promise<unknown>>();
      const [pendingCount, setPendingCount] = createSignal(0);
      const register = (promise: Promise<unknown>) => {
        if (pendingPromises.has(promise)) return;
        pendingPromises.add(promise);
        queueMicrotask(() => setPendingCount(pendingPromises.size));
        void promise.finally(() => {
          pendingPromises.delete(promise);
          setPendingCount(pendingPromises.size);
        });
      };
      return createComponent(FixtureSuspenseContext, {
        value: { register },
        get children() {
          return [
            createComponent(Dynamic, {
              component: 'div',
              get style() {
                return { display: pendingCount() > 0 ? 'none' : 'contents' };
              },
              get children() {
                return materializeReactive(() => props.children);
              },
            }),
            createComponent(Show, {
              get when() {
                return pendingCount() > 0;
              },
              get children() {
                return materializeReactive(() => props.fallback);
              },
            }),
          ];
        },
      });
    }
    if (type === StrictMode) {
      // React development StrictMode replays mount effects. Dispose and mount
      // the native subtree once after its first commit, so cleanup is tested.
      const [phase, setPhase] = createSignal(0);
      queueMicrotask(() => {
        setPhase(1);
        flush();
        setPhase(2);
        flush();
      });
      return createComponent(Show, {
        get when() {
          return phase() !== 1;
        },
        keyed: true,
        get children() {
          return materializeReactive(() => props.children);
        },
      });
    }
    if (typeof type === "string")
      return createComponent(
        Dynamic,
        mergeProps(propsForNative(props, true), { component: type }),
      );
    if (typeof type !== "function")
      throw new Error("Unsupported fixture element type.");
    const resolvedType = nativeOverride?.(type) ?? type;
    const source = native.get(resolvedType);
    if (source) {
      recordNativeExecution(source);
      return createComponent(resolvedType, propsForNative(props, false));
    }
    const runFixture = createFixtureHost(type);
    // A retained fixture function can be read once more while its conditional
    // child is being removed. Do not ask that function for props after the
    // descriptor has changed to null.
    const output = createMemo(() => {
      const current = read();
      return isValidElement(current) ? runFixture(current.props) : undefined;
    });
    return materializeReactive(output);
  });
}

export async function flushMicrotasks() {
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}
export async function act<T>(callback: () => T | Promise<T>): Promise<T> {
  const result = await callback();
  await flushMicrotasks();
  return result;
}
export function randomStringValue() {
  return Math.random().toString(36).slice(2);
}
export function createDescribe(
  label: string,
  callback: (...args: any[]) => void,
) {
  const group = (...args: any[]) => describe(label, () => callback(...args));
  group.skip = (...args: any[]) => describe.skip(label, () => callback(...args));
  group.only = (...args: any[]) => describe.only(label, () => callback(...args));
  return group;
}

export function createRenderer() {
  let serverContainer: HTMLElement | undefined;
  return {
    render(element: FixtureElement, options: { container?: HTMLElement } = {}) {
      rendersInCase++;
      const container = options.container ?? document.createElement("div");
      if (!container.isConnected) document.body.appendChild(container);
      // A root StrictMode replay must finish before render returns. The test
      // may retain a node reference and click it after its first microtask.
      let initialElement: FixtureElement | any = element;
      if (isValidElement(element) && element.type === StrictMode) {
        const firstContainer = document.createElement("div");
        document.body.appendChild(firstContainer);
        const disposeFirst = render(
          () => materializeReactive(() => element.props.children),
          firstContainer,
        );
        flush();
        disposeFirst();
        firstContainer.remove();
        initialElement = element.props.children;
      }
      let update: (element: FixtureElement) => void;
      let initialError: unknown;
      const directPart = isValidElement(element) && typeof element.type === 'function'
        ? nativeSource(element.type)
        : undefined;
      const guardExpectedContextError = directPart === 'base-ui/packages/solid/src/controls.tsx#Checkbox.Indicator' ||
        directPart === 'base-ui/packages/solid/src/controls.tsx#Switch.Thumb' ||
        directPart?.startsWith('base-ui/packages/solid/src/structure.tsx#Tabs.');
      const dispose = render(() => {
        const [current, setCurrent] = createSignal(initialElement);
        update = (next) => setCurrent(() => next);
        if (!guardExpectedContextError) return materializeReactive(current);
        const guarded = createErrorBoundary(
          () => materializeReactive(current),
          (error) => {
            initialError = error();
            return undefined;
          },
        );
        return guarded();
      }, container);
      if (initialError) {
        dispose();
        container.remove();
        throw initialError;
      }
      const record = { dispose, container };
      mounted.add(record);
      return {
        container,
        baseElement: document.body,
        ...getQueriesForElement(container, queries),
        user: userEvent.setup(),
        rerender(next: FixtureElement) {
          update(next);
        },
        unmount() {
          dispose();
          container.remove();
          mounted.delete(record);
        },
      };
    },
    renderToString(
      element: FixtureElement,
      options: { container?: HTMLElement; wrapper?: (props: any) => any } = {},
    ) {
      if (!isServer)
        throw new Error("Solid SSR fixtures require the server test config.");
      rendersInCase++;
      const container =
        options.container ??
        (serverContainer ??= document.createElement("div"));
      if (!options.container) {
        if (!container.isConnected) document.body.appendChild(container);
        serverMounted.add(container);
      }
      const wrapped = options.wrapper
        ? {
            ...element,
            type: options.wrapper,
            props: { children: element },
          }
        : element;
      container.innerHTML = solidRenderToString(() =>
        materializeReactive(() => wrapped),
      );
      return {
        container,
        hydrate(): never {
          throw new Error("Hydration requires a client fixture runner.");
        },
      };
    },
  };
}

/** Hydrate the unchanged fixture descriptor with compiled Solid DOM components. */
export function hydrateFixtureRoot(container: HTMLElement, element: FixtureElement) {
  if (isServer) throw new Error('Solid hydration requires the client test config.');
  // The original test inserts SSR HTML directly, without a document shell.
  // Supply the same bootstrap state as Solid's HydrationScript would supply.
  (globalThis as any)._$HY = {
    events: [], completed: new WeakSet(), r: {}, fe() {},
  };
  rendersInCase++;
  let update: (next: FixtureElement) => void;
  const dispose = hydrate(() => {
    const [current, setCurrent] = createSignal(element);
    update = (next) => setCurrent(() => next);
    return materializeReactive(current);
  }, container);
  const record = { dispose, container };
  mounted.add(record);
  console.info('Native Solid hydration evidence:', JSON.stringify({ serverNodes: container.querySelectorAll('[_hk]').length }));
  return {
    render(next: FixtureElement) { update(next); flush(); },
    unmount() { dispose(); mounted.delete(record); },
  };
}

afterEach(() => {
  try {
    const state = expect.getState();
    console.info(
      "Native Solid case evidence:",
      JSON.stringify({
        testPath: state.testPath,
        fullName: state.currentTestName,
        renders: rendersInCase,
        nativeExecutions: Object.fromEntries(nativeExecutionsInCase),
      }),
    );
    if (rendersInCase)
      expect(
        nativeCallsInCase,
        "Every rendered original case must execute a registered native Solid component.",
      ).toBeGreaterThan(0);
  } finally {
    for (const { dispose, container } of mounted) {
      dispose();
      container.remove();
    }
    mounted.clear();
    for (const container of serverMounted) container.remove();
    serverMounted.clear();
    expect(
      document.querySelectorAll('[data-base-ui-portal]').length,
      'The native fixture left a Base UI portal in the document after cleanup.',
    ).toBe(0);
    rendersInCase = 0;
    nativeCallsInCase = 0;
    nativeExecutionsInCase.clear();
  }
});
afterAll(() => {
  console.info(
    "Native Solid execution evidence:",
    JSON.stringify(Object.fromEntries(nativeExecutions)),
  );
});
