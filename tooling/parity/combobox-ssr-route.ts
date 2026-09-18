import {
  Combobox as NativeCombobox,
  Autocomplete as NativeAutocomplete,
} from "../../base-ui/packages/solid/src/selection";
import {
  Dialog as NativeDialog,
  Popover as NativePopover,
} from "../../base-ui/packages/solid/src/overlays";
import { Input as NativeInput } from "../../base-ui/packages/solid/src/controls";
import { registerNative } from "./fixture-renderer";

function parts<T extends Record<string, Function>>(
  name: string,
  value: T,
  file: string,
): T {
  for (const [part, component] of Object.entries(value)) {
    registerNative(
      component,
      `base-ui/packages/solid/src/${file}#${name}.${part}`,
    );
  }
  return value;
}

export const Autocomplete = parts(
  "Autocomplete",
  NativeAutocomplete,
  "selection.tsx",
);
export const Combobox = parts("Combobox", NativeCombobox, "selection.tsx");
export const Dialog = parts("Dialog", NativeDialog, "overlays.tsx");
export const Popover = parts("Popover", NativePopover, "overlays.tsx");
export const Input = registerNative(
  NativeInput,
  "base-ui/packages/solid/src/controls.tsx#Input",
);
