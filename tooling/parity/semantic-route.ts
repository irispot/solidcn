import {
  Input as NativeInput,
  Meter as NativeMeter,
  Progress as NativeProgress,
  Toggle as NativeToggle,
  ToggleGroup as NativeToggleGroup,
} from "../../base-ui/packages/solid/src/controls";
import { Avatar as NativeAvatar } from "../../base-ui/packages/solid/src/structure";
import { registerNative } from "./fixture-renderer";

function parts<T extends Record<string, Function>>(
  name: string,
  value: T,
  source: string,
): T {
  for (const [part, component] of Object.entries(value))
    registerNative(
      component,
      `base-ui/packages/solid/src/${source}#${name}.${part}`,
    );
  return value;
}

export const Meter = parts("Meter", NativeMeter, "controls.tsx");
export const Progress = parts("Progress", NativeProgress, "controls.tsx");
export const Avatar = parts("Avatar", NativeAvatar, "structure.tsx");
export const Input = registerNative(
  NativeInput,
  "base-ui/packages/solid/src/controls.tsx#Input",
);
export const Toggle = registerNative(
  NativeToggle,
  "base-ui/packages/solid/src/controls.tsx#Toggle",
);
export const ToggleGroup = registerNative(
  NativeToggleGroup,
  "base-ui/packages/solid/src/controls.tsx#ToggleGroup",
);
