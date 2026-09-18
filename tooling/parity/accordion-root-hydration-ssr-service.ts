import { Accordion } from '../../base-ui/packages/solid/src/structure';
import { createRenderer, registerNative, setNativeOverride } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const parts = new Map<string, Function>();
for (const [part, component] of Object.entries(Accordion)) {
  const id = `base-ui/packages/solid/src/structure.tsx#Accordion.${part}`;
  parts.set(id, registerNative(component, id));
}

export function renderAccordionRootToString(
  element: FixtureElement,
  sourceOf: (component: Function) => string | undefined,
): string {
  setNativeOverride((component) => {
    const source = sourceOf(component);
    return source ? parts.get(source) : undefined;
  });
  const container = createRenderer().renderToString(element, {
    container: document.createElement('div'),
  }).container;
  const html = container.innerHTML;
  const trigger = container.querySelector('button');
  const panel = container.querySelector('[role="region"]');
  console.info('Native Solid Accordion SSR evidence:', JSON.stringify({
    hydrationKeys: html.match(/_hk=/g)?.length ?? 0,
    triggerId: trigger?.id,
    triggerControls: trigger?.getAttribute('aria-controls'),
    panelId: panel?.id,
    panelLabelledBy: panel?.getAttribute('aria-labelledby'),
  }));
  return html;
}
