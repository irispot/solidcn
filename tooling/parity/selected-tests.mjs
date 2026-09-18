// The same unchanged source files run in both reference and native modes.
export const selectedTests = [
  'base-ui/packages/react/src/separator/Separator.test.tsx',
  'base-ui/packages/react/src/button/Button.test.tsx',
  'base-ui/packages/react/src/use-render/useRender.test.tsx',
  'base-ui/packages/react/src/fieldset/root/FieldsetRoot.test.tsx',
  'base-ui/packages/react/src/fieldset/legend/FieldsetLegend.test.tsx',
  'base-ui/packages/react/src/field/description/FieldDescription.test.tsx',
  'base-ui/packages/react/src/input/Input.test.tsx',
  'base-ui/packages/react/src/avatar/root/AvatarRoot.test.tsx',
  'base-ui/packages/react/src/toggle/Toggle.test.tsx',
  ...['meter/Meter', 'progress/Progress'].flatMap((family) => {
    const [directory, name] = family.split('/');
    return ['Root', 'Label', 'Track', 'Indicator', 'Value'].map(
      (part) =>
        `base-ui/packages/react/src/${directory}/${part.toLowerCase()}/${name}${part}.test.tsx`,
    );
  }),
  'base-ui/packages/react/src/merge-props/mergeProps.test.ts',
];

const controls = 'base-ui/packages/solid/src/controls.tsx#';
const structure = 'base-ui/packages/solid/src/structure.tsx#';
export const selectedNativeTargets = {
  'base-ui/packages/react/src/separator/Separator.test.tsx': `${structure}Separator`,
  'base-ui/packages/react/src/button/Button.test.tsx': `${controls}Button`,
  'base-ui/packages/react/src/use-render/useRender.test.tsx': 'base-ui/packages/solid/src/core.tsx#useRender',
  'base-ui/packages/react/src/fieldset/root/FieldsetRoot.test.tsx': `${controls}Fieldset.Root`,
  'base-ui/packages/react/src/fieldset/legend/FieldsetLegend.test.tsx': `${controls}Fieldset.Legend`,
  'base-ui/packages/react/src/field/description/FieldDescription.test.tsx': `${controls}Field.Description`,
  'base-ui/packages/react/src/input/Input.test.tsx': `${controls}Input`,
  'base-ui/packages/react/src/avatar/root/AvatarRoot.test.tsx': `${structure}Avatar.Root`,
  'base-ui/packages/react/src/toggle/Toggle.test.tsx': `${controls}Toggle`,
  ...Object.fromEntries(['meter', 'progress'].flatMap((family) =>
    ['Root', 'Label', 'Track', 'Indicator', 'Value'].map((part) => [
      `base-ui/packages/react/src/${family}/${part.toLowerCase()}/${family[0].toUpperCase()}${family.slice(1)}${part}.test.tsx`,
      `${controls}${family[0].toUpperCase()}${family.slice(1)}.${part}`,
    ]))),
};
