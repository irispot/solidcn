import { nativeSource } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

export function renderToString(element: FixtureElement): string {
  const render = (globalThis as any).__solidCnMessageScrollerSsr;
  if (typeof render !== 'function')
    throw new Error('The live Solid MessageScroller SSR graph is not ready.');
  return render(element, nativeSource);
}
export * from './fixture-runtime';
export { act } from './fixture-renderer';
