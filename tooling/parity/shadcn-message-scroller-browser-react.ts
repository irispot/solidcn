export * from './fixture-runtime';

// The unchanged browser fixture uses React.memo for a stable item component.
// The descriptor bridge already keeps a same-type component and its DOM alive.
export function memo<T extends (props: any) => any>(component: T): T {
  return component;
}
