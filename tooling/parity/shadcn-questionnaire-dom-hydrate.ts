import { hydrateFixtureRoot } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

export function hydrateRoot(
  container: HTMLElement,
  element: FixtureElement,
  _options?: { onRecoverableError?: (error: unknown) => void },
) {
  return hydrateFixtureRoot(container, element);
}
