import { Form as SolidForm } from "../../base-ui/packages/solid/src/controls";
import { DirectionProvider as SolidDirectionProvider } from "../../base-ui/packages/solid/src/core";
import { registerNative } from "./fixture-renderer";

export const Form = registerNative(
  SolidForm,
  "base-ui/packages/solid/src/controls.tsx#Form",
);
export const DirectionProvider = registerNative(
  SolidDirectionProvider,
  "base-ui/packages/solid/src/core.tsx#DirectionProvider",
);
