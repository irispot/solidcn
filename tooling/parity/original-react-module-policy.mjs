// These original .ts files enter through unchanged test/fixture imports. The
// selected SSR assertions do not call them to render the tested component.
const reasons = [
  'base-ui/packages/react/src/internals/reasons.ts',
  'base-ui/packages/react/src/internals/reason-parts.ts',
];

const sliderFixtureModules = [
  ...reasons,
  'base-ui/packages/react/src/floating-ui-react/utils.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/composite.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/constants.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/element.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/event.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/nodes.ts',
  'base-ui/packages/react/src/floating-ui-react/utils/tabbable.ts',
  'base-ui/packages/react/src/internals/TransitionStatusDataAttributes.ts',
  'base-ui/packages/react/src/internals/composite/composite.ts',
  'base-ui/packages/react/src/internals/stateAttributesMapping.ts',
  'base-ui/packages/react/src/slider/utils/test-utils.ts',
  'base-ui/packages/react/src/tooltip/trigger/TooltipTriggerDataAttributes.ts',
  'base-ui/packages/react/src/utils/CommonPopupDataAttributes.ts',
  'base-ui/packages/react/src/utils/CommonTriggerDataAttributes.ts',
  'base-ui/packages/react/src/utils/popupStateMapping.ts',
];

export function unexpectedOriginalReactModules(modules, allowed = []) {
  const allow = new Set(allowed);
  return modules.filter((file) =>
    file.startsWith('base-ui/packages/react/src/') &&
    !/\.(?:test|spec)\.[jt]sx?$/.test(file) &&
    !allow.has(file));
}

export const selectedSsrFixtureModules = {
  slider: sliderFixtureModules,
  combobox: reasons,
  navigation: [],
  select: [],
};
