import { Questionnaire as NativeQuestionnaire } from '../../shadcn-ui/packages/solid/src/internal/questionnaire';
import { registerNative } from './fixture-renderer';

export const Questionnaire = Object.fromEntries(
  Object.entries(NativeQuestionnaire).map(([part, component]) => [
    part,
    registerNative(component, `shadcn-ui/packages/solid/src/internal/questionnaire.tsx#Questionnaire.${part}`),
  ]),
) as typeof NativeQuestionnaire;
