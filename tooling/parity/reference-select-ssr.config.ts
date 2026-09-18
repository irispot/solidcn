import { mergeConfig } from "vitest/config";
import referenceConfig from "./reference.config.ts";
import { selectSsrTestFile, selectSsrTestName } from "./select-ssr-selected.mjs";

const config = mergeConfig(referenceConfig, {
  test: {
    name: "unchanged-select-react-reference-ssr",
    include: [selectSsrTestFile],
    testNamePattern: selectSsrTestName,
  },
});

config.test!.include = [selectSsrTestFile];
export default config;
