import type { ComponentProps, ValidComponent } from '@solidjs/web';

/** Native events can stop the Base UI handler without stopping browser behavior. */
export type BaseUIEvent<T> = T & {
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean;
};
type WithBaseUIEvent<T> = {
  [Key in keyof T]: Key extends `on${string}`
    ? T[Key] extends ((event: infer Event, ...args: infer Args) => infer Result) | undefined
      ? ((event: BaseUIEvent<Event>, ...args: Args) => Result) | undefined
      : T[Key]
    : T[Key];
};
type PropsOf<T extends ValidComponent> = WithBaseUIEvent<ComponentProps<T>> & {
  className?: string;
};
type InputProps<T extends ValidComponent> =
  PropsOf<T> | ((otherProps: PropsOf<T>) => PropsOf<T>) | undefined;
type Props = Record<string, unknown>;
type Handler = (...arguments_: unknown[]) => unknown;
const EMPTY_PROPS = {};

/**
 * Merge native Solid props. The last object takes precedence. Event handlers
 * run from right to left. Classes use the same right-to-left order. Refs are
 * replaced, as in the upstream public mergeProps contract.
 *
 * Object getters remain getters. Props functions receive the props merged so
 * far and take responsibility for their own event handler composition.
 */
export function mergeProps(
  ...props: (Props | ((previous: Props) => Props) | undefined)[]
): Props & { class?: string };
export function mergeProps<T extends ValidComponent>(...props: InputProps<T>[]): PropsOf<T>;
export function mergeProps(...props: (Props | ((previous: Props) => Props) | undefined)[]): Props {
  return mergePropsN(props);
}

export function mergePropsN<T extends ValidComponent>(props: InputProps<T>[]): PropsOf<T> {
  if (props.length === 0) return EMPTY_PROPS as PropsOf<T>;
  let merged = createInitialMergedProps(props[0]);
  for (let index = 1; index < props.length; index++) merged = mergeInto(merged, props[index]);
  return merged as PropsOf<T>;
}

function createInitialMergedProps<T extends ValidComponent>(input: InputProps<T>): Props {
  if (typeof input === 'function') return copyProps(input(EMPTY_PROPS as PropsOf<T>), false);
  return copyProps(input, true);
}

function copyProps(input: object | undefined, wrapHandlers: boolean): Props {
  const result: Props = {};
  if (!input) return result;
  for (const key of Object.keys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    const read = () => (input as Props)[key];
    if (descriptor?.get) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        get: () => {
          const value = read();
          return wrapHandlers && isEventHandler(key, value) ? wrapEventHandler(value) : value;
        },
      });
    } else {
      const value = read();
      result[key] = wrapHandlers && isEventHandler(key, value) ? wrapEventHandler(value) : value;
    }
  }
  return result;
}

function mergeInto<T extends ValidComponent>(merged: Props, input: InputProps<T>): Props {
  if (typeof input === 'function') return input(merged as PropsOf<T>) as Props;
  if (!input) return merged;
  for (const key in input) {
    const prior = Object.getOwnPropertyDescriptor(merged, key);
    const next = Object.getOwnPropertyDescriptor(input, key);
    const priorValue = prior?.get ? () => prior.get!.call(merged) : () => prior?.value;
    const external = () => (input as Props)[key];
    const resolve = () => {
      const value = external();
      if (key === 'style')
        return mergeObjects(priorValue() as object | undefined, value as object | undefined);
      if (key === 'className' || key === 'class')
        return mergeClassNames(priorValue() as string | undefined, value as string | undefined);
      if (isEventHandler(key, value))
        return mergeEventHandlers(priorValue() as Handler | undefined, value);
      return value;
    };
    Object.defineProperty(
      merged,
      key,
      prior?.get || next?.get
        ? { configurable: true, enumerable: true, get: resolve }
        : { configurable: true, enumerable: true, writable: true, value: resolve() },
    );
  }
  return merged;
}

function mergeObjects(a: object | undefined, b: object | undefined) {
  if (a && !b) return a;
  if (!a && b) return b;
  return a || b ? { ...a, ...b } : undefined;
}

function isEventHandler(key: string, value: unknown): value is Handler | undefined {
  const first = key.charCodeAt(0);
  const second = key.charCodeAt(1);
  const third = key.charCodeAt(2);
  return (
    first === 111 &&
    second === 110 &&
    third >= 65 &&
    third <= 90 &&
    (typeof value === 'function' || value === undefined)
  );
}

function mergeEventHandlers(ourHandler: Handler | undefined, theirHandler: Handler | undefined) {
  if (!theirHandler) return ourHandler;
  if (!ourHandler) return wrapEventHandler(theirHandler);
  return (...args: unknown[]) => {
    const event = args[0];
    if (isPreventableEvent(event)) {
      const baseUIEvent = makeEventPreventable(event);
      const result = theirHandler(...args);
      if (!baseUIEvent.baseUIHandlerPrevented) ourHandler(...args);
      return result;
    }
    const result = theirHandler(...args);
    ourHandler(...args);
    return result;
  };
}

function wrapEventHandler(handler: Handler | undefined) {
  if (!handler) return handler;
  return (...args: unknown[]) => {
    const event = args[0];
    if (isPreventableEvent(event)) makeEventPreventable(event);
    return handler(...args);
  };
}

export function makeEventPreventable<T extends object>(event: T): BaseUIEvent<T> {
  const target = event as T & {
    preventBaseUIHandler: () => void;
    baseUIHandlerPrevented?: boolean;
  };
  target.preventBaseUIHandler = () => {
    target.baseUIHandlerPrevented = true;
  };
  return target;
}

export function mergeClassNames(
  ourClassName: string | undefined,
  theirClassName: string | undefined,
) {
  return theirClassName
    ? ourClassName
      ? `${theirClassName} ${ourClassName}`
      : theirClassName
    : ourClassName;
}

function isPreventableEvent(event: unknown): event is object {
  return (
    event !== null &&
    typeof event === 'object' &&
    ('nativeEvent' in event ||
      ('preventDefault' in event && typeof event.preventDefault === 'function' && 'type' in event))
  );
}
