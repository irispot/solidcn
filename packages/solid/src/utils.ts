import type { ComponentProps as WebComponentProps, ValidComponent, JSX } from '@solidjs/web';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mergePropsN } from '@solid-cn/base-ui/merge-props';

export type ComponentProps<T extends ValidComponent> = T extends keyof JSX.IntrinsicElements
  ? Omit<WebComponentProps<T>, 'class' | 'className' | 'ref' | 'id' | 'style'> & {
      className?: string;
      class?: string;
      id?: string;
      style?: string | JSX.CSSProperties;
      ref?: (element: any) => void;
      render?: (props: Record<string, any>) => JSX.Element;
    }
  : WebComponentProps<T> & { className?: string; class?: string };
export type DOMProps = JSX.HTMLAttributes<HTMLElement> & {
  className?: string;
  [key: string]: unknown;
};

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export function mergeRenderProps(...props: Record<string, any>[]): Record<string, any> {
  return mergePropsN(props);
}

/** React registry selectors use explicit true/false values for custom data attributes. */
export function dataValue<T>(value: T): T | 'true' | 'false' {
  return value === true ? 'true' : value === false ? 'false' : value;
}

/** A view of the source props: do not read reactive fields during component setup. */
export function omitProps<T extends object, K extends PropertyKey>(
  props: T,
  keys: readonly K[],
): Omit<T, K> & (string extends keyof T ? T : {}) {
  const excluded = new Set<PropertyKey>(keys);
  if (excluded.has('className')) excluded.add('class');
  const read = (key: PropertyKey) => {
    if (excluded.has(key)) return undefined;
    const value = Reflect.get(props, key);
    // These attributes use string values in the original React DOM contract.
    // Solid's generic spread would otherwise serialize true as an empty value.
    return typeof key === 'string' && /^(?:data-|aria-)/.test(key) ? dataValue(value) : value;
  };
  return new Proxy(props, {
    get(_target, key) {
      return read(key);
    },
    has(target, key) {
      return !excluded.has(key) && key in target;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => !excluded.has(key));
    },
    getOwnPropertyDescriptor(target, key) {
      return excluded.has(key)
        ? undefined
        : { configurable: true, enumerable: true, get: () => read(key) };
    },
  }) as Omit<T, K> & (string extends keyof T ? T : {});
}
