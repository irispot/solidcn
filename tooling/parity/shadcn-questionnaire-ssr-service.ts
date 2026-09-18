import { Questionnaire } from '../../shadcn-ui/packages/solid/src/internal/questionnaire';
import {
  createRenderer,
  registerNative,
  setNativeOverride,
} from './fixture-renderer';
import type { FixtureElement } from './fixture-runtime';

const parts = new Map<string, Function>(
  Object.entries(Questionnaire).map(([part, component]) => {
    const source = `shadcn-ui/packages/solid/src/internal/questionnaire.tsx#Questionnaire.${part}`;
    return [source, registerNative(component, source)];
  }),
);

export function renderQuestionnaireToString(
  element: FixtureElement,
  sourceOf: (component: Function) => string | undefined,
): string {
  setNativeOverride((component) => {
    const source = sourceOf(component);
    return source ? parts.get(source) : undefined;
  });
  return createRenderer().renderToString(element).container.innerHTML;
}
