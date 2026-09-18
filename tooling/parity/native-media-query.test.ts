import { createRoot, flush } from 'solid-js';
import { afterEach, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../../base-ui/packages/solid/src/unstable-use-media-query';

afterEach(() => vi.unstubAllGlobals());

it('uses a custom matchMedia source, strips @media, and removes the listener', () => {
  let matches = false;
  let onChange: EventListenerOrEventListenerObject | undefined;
  let query = '';
  const remove = vi.fn();
  const matchMedia = vi.fn((value: string) => {
    query = value;
    return {
      get matches() { return matches; },
      addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
        onChange = listener;
      },
      removeEventListener: remove,
    } as unknown as MediaQueryList;
  });
  const result = createRoot((dispose) => ({
    read: useMediaQuery('@media (min-width: 800px)', { matchMedia }),
    dispose,
  }));
  flush();
  expect(query).toBe('(min-width: 800px)');
  expect(result.read()).toBe(false);
  matches = true;
  if (typeof onChange === 'function') onChange(new Event('change'));
  flush();
  expect(result.read()).toBe(true);
  result.dispose();
  expect(remove).toHaveBeenCalledWith('change', onChange);
});

it('uses the default when matchMedia is not available', () => {
  vi.stubGlobal('matchMedia', undefined);
  const result = createRoot((dispose) => ({
    read: useMediaQuery('(max-width: 400px)', { defaultMatches: true }),
    dispose,
  }));
  expect(result.read()).toBe(true);
  result.dispose();
});
