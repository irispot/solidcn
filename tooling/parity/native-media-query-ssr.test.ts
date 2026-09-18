import { createRoot } from 'solid-js';
import { expect, it, vi } from 'vitest';
import { useMediaQuery } from '../../base-ui/packages/solid/src/unstable-use-media-query';

it('uses the server media source for the first server value', () => {
  const matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
  const ssrMatchMedia = vi.fn(() => ({ matches: true }));
  const read = createRoot(() => useMediaQuery('@media (min-width: 800px)', {
    defaultMatches: false,
    matchMedia,
    ssrMatchMedia,
  }));
  expect(read()).toBe(true);
  expect(ssrMatchMedia).toHaveBeenCalledWith('(min-width: 800px)');
  expect(matchMedia).not.toHaveBeenCalled();
});

it('uses matchMedia on the server only when noSsr is set', () => {
  const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
  const read = createRoot(() => useMediaQuery('(min-width: 800px)', {
    defaultMatches: false,
    matchMedia,
    noSsr: true,
  }));
  expect(read()).toBe(true);
  expect(matchMedia).toHaveBeenCalledWith('(min-width: 800px)');
});
