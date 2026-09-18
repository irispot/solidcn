import { resolve } from "node:path";
import type { Alias } from "vite";
import { mergeConfig } from "vitest/config";
import solidSsrConfig from "./dual-ssr-solid.config.ts";
import {
  comboboxSsrTestFile,
  comboboxSsrTestName,
} from "./combobox-ssr-selected.mjs";

const route = resolve(import.meta.dirname, "combobox-ssr-route.ts");
const unsupported = resolve(import.meta.dirname, "combobox-ssr-unsupported.ts");
const config = mergeConfig(solidSsrConfig, {
  test: {
    name: "unchanged-combobox-native-solid-ssr",
    include: [comboboxSsrTestFile],
    testNamePattern: comboboxSsrTestName,
  },
});

config.test!.include = [comboboxSsrTestFile];
config.resolve!.alias = [
  {
    find: /^#test-utils$/,
    replacement: resolve(import.meta.dirname, "combobox-ssr-fixture-entry.ts"),
  },
  {
    find: /^@base-ui\/react\/(?:combobox|autocomplete|dialog|popover|input)$/,
    replacement: route,
  },
  { find: /^react-dom$/, replacement: unsupported },
  {
    find: /^\.\.\/\.\.\/internals\/composite\/(?:root\/CompositeRoot|item\/CompositeItem)$/,
    replacement: unsupported,
  },
  { find: /^\.\/ComboboxRootContext$/, replacement: unsupported },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
