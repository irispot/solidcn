import { beforeEach, vi } from 'vitest';
import { act, createRenderer as solidCreateRenderer } from './fixture-renderer';
import { cloneElement, type FixtureElement } from './fixture-runtime';
import { assignRef } from '../../base-ui/packages/solid/src/core';

// Keep the original assertion helper. Only the renderer transport changes.
export { popupConformanceTests } from '../../base-ui/packages/react/test/popupConformanceTests';
export { describeConformance } from '../../base-ui/packages/react/test/describeConformance';
export { wait } from '../../base-ui/packages/react/test/wait';
export const isJSDOM = true;
export function mergeRefs<T>(...refs: Array<((value: T | null) => void) | { current: T | null } | null | undefined>) {
  return (value: T | null) => refs.forEach((ref) => assignRef(ref, value));
}

export function createRenderer(options?: { clockOptions?: Parameters<typeof vi.useFakeTimers>[0] }) {
  const result = solidCreateRenderer();
  return {
    ...result,
    async render(element: FixtureElement, renderOptions?: { container?: HTMLElement }) {
      const mounted = await act(() => result.render(element, renderOptions));
      return {
        ...mounted,
        async rerender(next: FixtureElement) {
          await act(() => mounted.rerender(next));
        },
        async setProps(nextProps: Record<string, unknown>) {
          await act(() => mounted.rerender(cloneElement(element, nextProps)));
        },
      };
    },
    clock: {
      withFakeTimers() {
        beforeEach(() => vi.useFakeTimers(options?.clockOptions));
      },
      tickAsync(milliseconds: number) {
        return vi.advanceTimersByTimeAsync(milliseconds);
      },
    },
  };
}
