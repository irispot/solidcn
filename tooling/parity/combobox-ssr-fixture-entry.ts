import { beforeEach, vi } from "vitest";
import { createRenderer as originalCreateRenderer } from "../../base-ui/packages/react/test/createRenderer";

// The original file registers fake-clock hooks when its filtered Form groups
// are defined. Keep that registration contract for the unchanged source.
export function createRenderer(
  options?: Parameters<typeof originalCreateRenderer>[0],
) {
  const result = originalCreateRenderer(options);
  return {
    ...result,
    clock: {
      withFakeTimers() {
        beforeEach(() => vi.useFakeTimers(options?.clockOptions));
      },
    },
  };
}

// The conformance helper and all its assertions are the original files.
export { popupConformanceTests } from "../../base-ui/packages/react/test/popupConformanceTests";
export const isJSDOM = true;
