import { createSignal, untrack } from 'solid-js';
export * from './hooks-runtime';
export { Dynamic as DocDynamic } from '@solidjs/web';
export { Loading as DocLoading } from 'solid-js';
export { For as DocFor } from 'solid-js';
export { cn, mergeRenderProps, omitProps } from '../../../shadcn-ui/packages/solid/src/utils';

// React state initializers run once. Solid's function-form signal is a writable
// memo, so capture the initial value first, including function-valued state.
export function createDocState<T>(initial: T | (() => T)) {
  const value = typeof initial === 'function' ? untrack(initial as () => T) : initial;
  return createSignal<T>(() => value);
}
export function docAttribute<T>(value: T): T | 'true' | 'false' {
  return value === true ? 'true' : value === false ? 'false' : value;
}
