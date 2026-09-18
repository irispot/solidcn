import { Checkbox, CheckboxGroup, Field } from '../../base-ui/packages/solid/src/controls';
import { createRenderer, registerNative, setNativeOverride } from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const parts = new Map<string, Function>();
for (const [name, source] of [['Checkbox', Checkbox], ['Field', Field]] as const) {
  for (const [part, component] of Object.entries(source)) {
    const id = `base-ui/packages/solid/src/controls.tsx#${name}.${part}`;
    parts.set(id, registerNative(component, id));
  }
}
const groupId = 'base-ui/packages/solid/src/controls.tsx#CheckboxGroup';
parts.set(groupId, registerNative(CheckboxGroup, groupId));

export function renderCheckboxGroupToString(
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
  console.info('Native Solid CheckboxGroup SSR evidence:', JSON.stringify({
    hydrationKeys: html.match(/_hk=/g)?.length ?? 0,
  }));
  return html;
}
