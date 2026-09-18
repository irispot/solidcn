import {
  Fieldset as NativeFieldset,
  Field as NativeField,
  Checkbox as NativeCheckbox,
  CheckboxGroup as NativeCheckboxGroup,
  RadioGroup as NativeRadioGroup,
  Slider as NativeSlider,
} from "../../base-ui/packages/solid/src/controls";
import { registerNative } from "./fixture-renderer";

function parts<T extends Record<string, Function>>(name: string, value: T): T {
  for (const [part, component] of Object.entries(value))
    registerNative(
      component,
      `base-ui/packages/solid/src/controls.tsx#${name}.${part}`,
    );
  return value;
}

// These are the shipped functions. No fixture component supplies their behavior.
export const Fieldset = parts("Fieldset", NativeFieldset);
export const Field = parts("Field", NativeField);
export const Checkbox = parts("Checkbox", NativeCheckbox);
export const Slider = parts("Slider", NativeSlider);
export const CheckboxGroup = registerNative(
  NativeCheckboxGroup,
  "base-ui/packages/solid/src/controls.tsx#CheckboxGroup",
);
export const RadioGroup = registerNative(
  NativeRadioGroup,
  "base-ui/packages/solid/src/controls.tsx#RadioGroup",
);
