import { createRenderer } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

export function createRoot(container: HTMLElement) {
  let mounted: ReturnType<ReturnType<typeof createRenderer>['render']> | undefined;
  return {
    render(element: FixtureElement) {
      if (mounted) mounted.rerender(element);
      else mounted = createRenderer().render(element, { container });
    },
    unmount() {
      mounted?.unmount();
      mounted = undefined;
    },
  };
}
