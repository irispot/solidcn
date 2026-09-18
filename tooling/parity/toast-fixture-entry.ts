import { flush } from 'solid-js';
import { vi } from 'vitest';
import { createRenderer as createBaseRenderer } from './select-client-fixture-entry';

export * from './select-client-fixture-entry';

export function createRenderer(options?: Parameters<typeof createBaseRenderer>[0]) {
  const renderer = createBaseRenderer(options);
  return {
    ...renderer,
    clock: {
      ...renderer.clock,
      tick(milliseconds: number) {
        vi.advanceTimersByTime(milliseconds);
        flush();
      },
    },
  };
}
