import { createSignal, createEffect } from 'solid-js';
export function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = createSignal(false);
  createEffect(
    () => breakpoint,
    (value) => {
      const query = window.matchMedia(`(max-width: ${value - 1}px)`);
      const update = () => setMobile(query.matches);
      update();
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    },
  );
  return mobile;
}
