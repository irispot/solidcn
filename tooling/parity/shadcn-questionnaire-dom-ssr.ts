import { createRenderer } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const renderer = createRenderer();
export function renderToString(element: FixtureElement) {
  return renderer.renderToString(element).container.innerHTML;
}
