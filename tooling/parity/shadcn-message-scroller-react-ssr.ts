import { createEffect, onCleanup } from 'solid-js';
export * from './fixture-runtime';
export { act } from './fixture-renderer';

// The original fixture uses this hook once to request an initial scroll target.
export function useLayoutEffect(callback: () => void | (() => void), _dependencies?: readonly unknown[]) {
  createEffect(() => 0, () => {
    const cleanup = callback();
    if (cleanup) onCleanup(cleanup);
  });
}
