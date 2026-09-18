import { flush } from 'solid-js';

/** Commit the unchanged browser fixture's render callback before it reads the DOM. */
export function flushSync(callback: () => void) {
  callback();
  flush();
}
