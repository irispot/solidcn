import { resolve } from "node:path";
import type { Alias } from "vite";
import { mergeConfig } from "vitest/config";
import solidSsrConfig from "./dual-ssr-solid.config.ts";
import { selectSsrTestFile, selectSsrTestName } from "./select-ssr-selected.mjs";

const route = resolve(import.meta.dirname, "select-ssr-route.ts");
const config = mergeConfig(solidSsrConfig, {
  test: {
    name: "unchanged-select-native-solid-ssr",
    include: [selectSsrTestFile],
    testNamePattern: selectSsrTestName,
  },
});

config.test!.include = [selectSsrTestFile];
config.resolve!.alias = [
  {
    find: /^#test-utils$/,
    replacement: resolve(import.meta.dirname, "select-ssr-fixture-entry.ts"),
  },
  {
    find: /^@base-ui\/react\/(?:select|popover|field|form)$/,
    replacement: route,
  },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
