import { mergeConfig } from "vitest/config";
import { resolve } from "node:path";
import separatorConfig from "./separator.config.ts";

export default mergeConfig(separatorConfig, {
  resolve: {
    alias: [
      {
        find: /^@base-ui\/react\/button$/,
        replacement: resolve(import.meta.dirname, "button-route.ts"),
      },
      {
        find: /^@base-ui\/react\/use-render$/,
        replacement: resolve(import.meta.dirname, "use-render-route.ts"),
      },
      {
        find: /^@base-ui\/react\/(?:fieldset|field|checkbox|checkbox-group|radio-group|slider)$/,
        replacement: resolve(import.meta.dirname, "fieldset-route.ts"),
      },
      {
        find: /^@base-ui\/react\/(?:meter|progress|input|avatar|toggle|toggle-group)$/,
        replacement: resolve(import.meta.dirname, "semantic-route.ts"),
      },
      {
        find: /^\.\.\/toggle-group\/ToggleGroup$/,
        replacement: resolve(import.meta.dirname, "semantic-route.ts"),
      },
    ],
  },
  test: {
    name: "unchanged-components-native-solid",
    include: [
      "base-ui/packages/react/src/button/Button.test.tsx",
      "base-ui/packages/react/src/use-render/useRender.test.tsx",
      "base-ui/packages/react/src/fieldset/root/FieldsetRoot.test.tsx",
      "base-ui/packages/react/src/fieldset/legend/FieldsetLegend.test.tsx",
      "base-ui/packages/react/src/field/description/FieldDescription.test.tsx",
      "base-ui/packages/react/src/input/Input.test.tsx",
      "base-ui/packages/react/src/avatar/root/AvatarRoot.test.tsx",
      "base-ui/packages/react/src/toggle/Toggle.test.tsx",
      ...["meter/Meter", "progress/Progress"].flatMap((family) => {
        const [directory, name] = family.split("/");
        return ["Root", "Label", "Track", "Indicator", "Value"].map(
          (part) =>
            `base-ui/packages/react/src/${directory}/${part.toLowerCase()}/${name}${part}.test.tsx`,
        );
      }),
    ],
  },
});
