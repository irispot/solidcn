import { jsx } from './fixture-runtime';

// The unchanged Tabs test uses the router only to supply an anchor fixture.
// Keep its route wrapper and link in the fixture transport, not in Tabs.
export function MemoryRouter(props: { children?: unknown }) {
  return props.children;
}

export function Link(props: Record<string, unknown> & { to: string }) {
  const { to, ...anchorProps } = props;
  return jsx('a', { ...anchorProps, href: to });
}
