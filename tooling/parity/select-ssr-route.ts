import { Select as SolidSelect } from "../../base-ui/packages/solid/src/selection";
import { Popover as SolidPopover } from "../../base-ui/packages/solid/src/overlays";
import { Field as SolidField, Form as SolidForm } from "../../base-ui/packages/solid/src/controls";
import { registerNative } from "./fixture-renderer";

function parts<T extends Record<string, Function>>(
  name: string,
  value: T,
  file: string,
): T {
  for (const [part, component] of Object.entries(value)) {
    registerNative(component, `base-ui/packages/solid/src/${file}#${name}.${part}`);
  }
  return value;
}

export const Select = parts("Select", SolidSelect, "selection.tsx");
export const Popover = parts("Popover", SolidPopover, "overlays.tsx");
export const Field = parts("Field", SolidField, "controls.tsx");
export const Form = registerNative(
  SolidForm,
  "base-ui/packages/solid/src/controls.tsx#Form",
);
