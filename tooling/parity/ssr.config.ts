import { resolve } from "node:path";
import { transformWithOxc, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";

const root = resolve(import.meta.dirname, "../..");
const tooling = (file: string) => resolve(import.meta.dirname, file);
const fixtureJsx: Plugin = {
  name: "unchanged-upstream-fixture-jsx-ssr",
  enforce: "pre",
  async transform(code, id) {
    if (!id.includes("/base-ui/packages/react/") || !id.endsWith(".tsx"))
      return;
    return transformWithOxc(code, id, {
      sourceType: "module",
      jsx: { runtime: "automatic", importSource: "@solid-cn/parity-fixture" },
    });
  },
};

export default defineConfig({
  root,
  plugins: [
    fixtureJsx,
    solid({
      hot: false,
      include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/,
      solid: { generate: "ssr" },
    }),
  ],
  resolve: {
    conditions: ["node", "development"],
    alias: [
      {
        find: /^@solidjs\/web$/,
        replacement: resolve(
          root,
          "node_modules/@solidjs/web/dist/server.dev.js",
        ),
      },
      {
        find: /^solid-js$/,
        replacement: resolve(root, "node_modules/solid-js/dist/server.js"),
      },
      { find: /^react$/, replacement: tooling("fixture-runtime.ts") },
      {
        find: /^@solid-cn\/parity-fixture\/jsx(?:-dev)?-runtime$/,
        replacement: tooling("fixture-runtime.ts"),
      },
      {
        find: /^@mui\/internal-test-utils$/,
        replacement: tooling("fixture-renderer.ts"),
      },
      { find: /^#test-utils$/, replacement: tooling("fixture-entry.ts") },
      {
        find: /^@base-ui\/react\/(?:fieldset|field|checkbox|checkbox-group|radio-group|slider)$/,
        replacement: tooling("fieldset-route.ts"),
      },
      {
        find: /^@base-ui\/react\/form$/,
        replacement: tooling("ssr-additional-route.ts"),
      },
      {
        find: /^@base-ui\/react\/direction-provider$/,
        replacement: tooling("ssr-additional-route.ts"),
      },
      {
        find: /^@base-ui\/utils\/platform$/,
        replacement: resolve(
          root,
          "base-ui/packages/utils/src/platform/index.ts",
        ),
      },
      {
        find: /^@base-ui\/utils\/(.*)$/,
        replacement: resolve(root, "base-ui/packages/utils/src/$1.ts"),
      },
    ],
  },
  test: {
    name: "unchanged-slider-native-solid-ssr",
    environment: "jsdom",
    globals: true,
    include: ["base-ui/packages/react/src/slider/root/SliderRoot.test.tsx"],
    testNamePattern: "does not link Slider.Label before hydration",
    setupFiles: [tooling("fixture-setup.ts")],
    reporters: ["default"],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
