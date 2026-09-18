import { useEffect, useRef } from './fixture-runtime';

export * from './fixture-runtime';

export function useLayoutEffect(
  callback: () => void | (() => void),
  dependencies?: readonly unknown[],
) {
  useEffect(callback, dependencies);
}

export function useCallback<Callback extends Function>(
  callback: Callback,
  dependencies: readonly unknown[],
): Callback {
  const stable = useRef({ callback, dependencies });
  if (dependencies.length !== stable.current.dependencies.length ||
      dependencies.some((value, index) => !Object.is(value, stable.current.dependencies[index])))
    stable.current = { callback, dependencies };
  return stable.current.callback;
}
