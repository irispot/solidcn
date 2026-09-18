import { act, createRenderer } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

let mounted: ReturnType<ReturnType<typeof createRenderer>['render']> | undefined;

export async function render(element: FixtureElement) {
  mounted = await act(() => createRenderer().render(element));
  return mounted;
}

export async function cleanup() {
  mounted?.unmount();
  mounted = undefined;
}
