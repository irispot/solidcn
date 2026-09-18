import { mergeConfig } from "vitest/config";
import referenceConfig from "./reference.config.ts";
import {
  comboboxSsrTestFile,
  comboboxSsrTestName,
} from "./combobox-ssr-selected.mjs";

const config = mergeConfig(referenceConfig, {
  test: {
    name: "unchanged-combobox-react-reference-ssr",
    include: [comboboxSsrTestFile],
    testNamePattern: comboboxSsrTestName,
  },
});

// mergeConfig joins include arrays. This run selects one original source file.
config.test!.include = [comboboxSsrTestFile];
export default config;
