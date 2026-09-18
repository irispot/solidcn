import {
  createEffect,
  createMemo,
  createRenderEffect,
  createUniqueId,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';

type Dependencies = readonly unknown[];
type Cleanup = void | (() => void);
const equalDependencies = (left: Dependencies, right: Dependencies) =>
  left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

// React compares declared dependencies, not every value read by the callback.
// The converter creates a callback factory that snapshots component values.
// This preserves the values seen by subscriptions and their later cleanup.
function dependencyMemo(read: () => Dependencies) {
  return createMemo(read, { equals: equalDependencies });
}

export function createDocEffect(dependencies: () => Dependencies, callback: () => () => Cleanup) {
  const current = dependencyMemo(dependencies);
  createEffect(current, () => callback()());
}

export function createDocLayoutEffect(
  dependencies: () => Dependencies,
  callback: () => () => Cleanup,
) {
  const current = dependencyMemo(dependencies);
  // Queue the first apply phase after this component has made its DOM and
  // assigned refs. Later runs remain in the synchronous render-effect phase.
  createRenderEffect(current, () => callback()(), { schedule: true });
}

export function createDocMemo<T>(dependencies: () => Dependencies, callback: () => () => T) {
  const current = dependencyMemo(dependencies);
  return createMemo(() => {
    current();
    return untrack(() => callback()());
  });
}

export function createDocCallback<T extends (...args: never[]) => unknown>(
  dependencies: () => Dependencies,
  callback: () => T,
) {
  const current = dependencyMemo(dependencies);
  return createMemo(() => {
    current();
    return untrack(callback);
  });
}

export const createDocDerived = createMemo;
export const createDocId = createUniqueId;

export function createDocRef<T>(initial: T | null) {
  return { current: initial };
}

export function docRef<T>(reference: { current: T | null }) {
  // Solid deliberately invokes DOM refs with no owner. Keep the element's
  // creation owner so cleanup follows that element, not a later callback.
  const owner = getOwner();
  return (element: T) => {
    reference.current = element;
    runWithOwner(owner, () =>
      onCleanup(() => {
        if (reference.current === element) reference.current = null;
      }),
    );
  };
}
