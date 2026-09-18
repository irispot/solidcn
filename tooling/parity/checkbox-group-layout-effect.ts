import { onSettled } from 'solid-js';

// Run the unchanged fixture's layout callback at the adapter commit boundary.
export function useIsoLayoutEffect(callback: () => void | (() => void), _dependencies?: readonly unknown[]) {
  onSettled(callback);
}
