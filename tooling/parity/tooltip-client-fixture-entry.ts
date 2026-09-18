export * from './select-client-fixture-entry';
export { advanceReactClock } from '../../base-ui/packages/react/test/advanceReactClock';
export { resetBrowserPointer } from '../../base-ui/packages/react/test/resetBrowserPointer';
import { afterEach, vi } from 'vitest';
import { flush } from 'solid-js';
import { createRenderer as createBaseRenderer } from './select-client-fixture-entry';

export function createRenderer(options?: Parameters<typeof createBaseRenderer>[0]) {
  const renderer = createBaseRenderer(options);
  return {
    ...renderer,
    clock: {
      ...renderer.clock,
      withFakeTimers() {
        renderer.clock.withFakeTimers();
        afterEach(() => vi.useRealTimers());
      },
      tick(milliseconds: number) {
        vi.advanceTimersByTime(milliseconds);
        flush();
      },
    },
  };
}
