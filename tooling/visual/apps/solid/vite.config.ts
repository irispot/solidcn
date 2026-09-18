import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { docsExamplesPlugin } from "../../docs/vite-plugin.mjs";
import { visualExampleCasesPlugin } from "../catalog-plugin.mjs";
import { isolatedPreviewPlugin } from "../isolated-preview-plugin.mjs";
import { visualImagePlugin } from "../image-plugin.mjs";
import { visualFontPlugin } from "../font-plugin.mjs";
const app = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(app, "../../../..");
export default defineConfig({
  root: app,
  plugins: [
    isolatedPreviewPlugin(),
    visualImagePlugin("solid"),
    visualFontPlugin("solid"),
    docsExamplesPlugin(),
    visualExampleCasesPlugin(),
    solid({ hot: false }),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: /^next\/font\/google$/, replacement: "virtual:visual-next-google-font" },
      {
        find: "@tanstack/ai/client",
        replacement: resolve(
          app,
          "../reference/node_modules/@tanstack/ai/dist/esm/client.js",
        ),
      },
      {
        find: "@tanstack/ai-client/devtools",
        replacement: resolve(
          app,
          "../reference/node_modules/@tanstack/ai-client/dist/esm/devtools.js",
        ),
      },
      {
        find: "@tanstack/table-core/static-functions",
        replacement: resolve(
          app,
          "../reference/node_modules/@tanstack/table-core/dist/static-functions.js",
        ),
      },
      {
        find: /^@solid-cn\/base-ui\/(.*)$/,
        replacement: resolve(
          workspace,
          "base-ui/packages/solid/src/$1/index.ts",
        ),
      },
      {
        find: "@solid-cn/base-ui",
        replacement: resolve(workspace, "base-ui/packages/solid/src/index.ts"),
      },
      {
        find: /^@solid-cn\/ui\/(.*)$/,
        replacement: resolve(workspace, "shadcn-ui/packages/solid/src/$1.tsx"),
      },
      {
        find: "date-fns",
        replacement: resolve(app, "../reference/node_modules/date-fns"),
      },
      {
        find: /^@shadcn\/helpers\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/packages/helpers/src/$1/index.ts",
        ),
      },
      {
        find: "@/lib/ai",
        replacement: resolve(workspace, "shadcn-ui/apps/v4/lib/ai.ts"),
      },
      {
        find: "@/lib/message-animations",
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/lib/message-animations.ts",
        ),
      },
      ...[
        "zod",
        "chrono-node",
        "embla-carousel-autoplay",
        "next",
        "@tanstack/table-core",
        "ai",
        "@tanstack/ai-client",
        "@tanstack/ai",
        "motion",
        "unified",
        "remark-parse",
        "remark-gfm",
        "remark-rehype",
        "rehype-raw",
        "rehype-sanitize",
        "rehype-harden",
        "remend",
        "unist-util-visit",
        "marked",
        "@streamdown/code",
      ].map((name) => ({
        find: name,
        replacement: resolve(app, "../reference/node_modules", name),
      })),
    ],
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "date-fns",
      "date-fns/locale",
      "next/dist/shared/lib/get-img-props",
      "next/dist/shared/lib/image-loader",
      '@tanstack/table-core', '@tanstack/table-core/static-functions', 'ai', '@tanstack/ai-client', 'motion',
      'unified', 'remark-parse', 'remark-gfm', 'remark-rehype', 'rehype-raw', 'rehype-sanitize', 'rehype-harden', 'remend', 'unist-util-visit', 'marked', '@streamdown/code',
    ],
  },
  define: {
    "process.env": JSON.stringify({ NODE_ENV: "development" }),
    __dirname: JSON.stringify("/"),
  },
  server: {
    host: "127.0.0.1",
    port: 5182,
    strictPort: true,
    hmr: false,
    ws: false,
    fs: { allow: [workspace] },
  },
});
