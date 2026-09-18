import { MessageScroller } from '../../shadcn-ui/packages/solid/src/internal/message-scroller';
import { createRenderer, registerNative, setNativeOverride } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const parts = new Map<string, Function>(
  Object.entries(MessageScroller).map(([part, component]) => {
    const source = `shadcn-ui/packages/solid/src/internal/message-scroller.tsx#MessageScroller.${part}`;
    return [source, registerNative(component, source)];
  }),
);

export function renderMessageScrollerToString(
  element: FixtureElement,
  sourceOf: (component: Function) => string | undefined,
): string {
  setNativeOverride((component) => {
    const source = sourceOf(component);
    return source ? parts.get(source) : undefined;
  });
  try {
    return createRenderer().renderToString(element).container.innerHTML;
  } finally {
    setNativeOverride(undefined);
  }
}
