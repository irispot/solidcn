import { afterEach, vi } from 'vitest';
import { createRenderer as createBaseRenderer } from './select-client-fixture-entry';

export * from './switch-browser-fixture-entry';

// The unchanged Scroll Area file uses fake time in one test. Restore real time
// before the later browser tests, as the React test renderer does.
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
    },
  };
}
