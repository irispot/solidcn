import { Tabs } from '../../base-ui/packages/solid/src/structure';
import { CSPProvider } from '../../base-ui/packages/solid/src/core';
import { createRenderer, registerNative, setNativeOverride } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const parts = new Map<string, Function>();
for (const [part, component] of Object.entries(Tabs)) {
  const id = `base-ui/packages/solid/src/structure.tsx#Tabs.${part}`;
  parts.set(id, registerNative(component, id));
}
const providerId = 'base-ui/packages/solid/src/core.tsx#CSPProvider';
parts.set(providerId, registerNative(CSPProvider, providerId));

export function renderTabsIndicatorToString(
  element: FixtureElement,
  sourceOf: (component: Function) => string | undefined,
): string {
  setNativeOverride((component) => {
    const source = sourceOf(component);
    return source ? parts.get(source) : undefined;
  });
  const html = createRenderer().renderToString(element, {
    container: document.createElement('div'),
  }).container.innerHTML;
  console.info('Native Solid Tabs Indicator SSR evidence:', JSON.stringify({
    hydrationKeys: html.match(/_hk=/g)?.length ?? 0,
    scripts: (html.match(/<script\b/g) ?? []).length,
  }));
  return html;
}
