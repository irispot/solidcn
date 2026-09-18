import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "../.."),
  plugins: [
    solid({
      hot: false,
      include: /\/base-ui\/packages\/solid\/src\/.+\.tsx?$/,
    }),
  ],
  resolve: { conditions: ["browser", "development"] },
  test: {
    name: "fixture-adapter-diagnostics",
    environment: "jsdom",
    include: ["tooling/parity/fixture-diagnostics.ts"],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
