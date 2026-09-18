import { createComponent } from 'solid-js';
import { Portal } from '@solidjs/web';
import { jsx } from './fixture-runtime';
import { registerNative } from './fixture-renderer';

const FixturePortal = registerNative(
  (props: { children: unknown; container: Element }) =>
    createComponent(Portal, {
      get mount() { return props.container; },
      get children() { return props.children; },
    }),
  'tooling/parity/select-client-fixture-dom.ts#Portal',
);

export function createPortal(children: unknown, container: Element) {
  return jsx(FixturePortal, { children, container });
}
