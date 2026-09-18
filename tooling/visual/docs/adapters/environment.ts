import { createEffect, createSignal, onCleanup } from 'solid-js';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(false);
  createEffect(
    () => query,
    (current) => {
      const media = window.matchMedia(current);
      const update = () => setMatches(media.matches);
      media.addEventListener('change', update);
      update();
      return () => media.removeEventListener('change', update);
    },
  );
  return matches;
}
export function useIsMobile(breakpoint = 768) {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}
export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: { timeout?: number; onCopy?: () => void } = {}) {
  const [isCopied, setCopied] = createSignal(false);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer);
  });
  function legacyCopy(value: string) {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    Object.assign(area.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, value.length);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
  return {
    get isCopied() {
      return isCopied();
    },
    async copyToClipboard(value: string) {
      if (typeof window === 'undefined' || !value) return false;
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          copied = true;
        } else copied = legacyCopy(value);
      } catch {
        copied = legacyCopy(value);
      }
      if (!copied) return false;
      setCopied(true);
      onCopy?.();
      if (timeout !== 0) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          setCopied(false);
        }, timeout);
        timers.add(timer);
      }
      return true;
    },
  };
}
