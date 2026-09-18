import { defineConfig } from "vite";
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
const deps = resolve(app, "node_modules");
export default defineConfig({
  root: app,
  plugins: [
    isolatedPreviewPlugin(),
    visualImagePlugin("react"),
    visualFontPlugin("react"),
    docsExamplesPlugin({ framework: "react" }),
    visualExampleCasesPlugin(),
    tailwindcss(),
  ],
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  // Next's webpack browser runtime supplies this asset base to compiled helpers.
  define: {
    "process.env": JSON.stringify({ NODE_ENV: "development" }),
    __dirname: JSON.stringify("/"),
  },
  resolve: {
    alias: [
      { find: /^next\/font\/google$/, replacement: "virtual:visual-next-google-font" },
      {
        find: "@tanstack/ai/client",
        replacement: resolve(deps, "@tanstack/ai/dist/esm/client.js"),
      },
      {
        find: "@tanstack/ai-client/devtools",
        replacement: resolve(deps, "@tanstack/ai-client/dist/esm/devtools.js"),
      },
      { find: /^next\/image$/, replacement: resolve(app, "next-image.ts") },
      { find: /^next\/link$/, replacement: resolve(app, "next-link.ts") },
      {
        find: /^@base-ui\/react\/(.*)$/,
        replacement: resolve(
          workspace,
          "base-ui/packages/react/src/$1/index.ts",
        ),
      },
      {
        find: "@base-ui/react",
        replacement: resolve(workspace, "base-ui/packages/react/src/index.ts"),
      },
      {
        find: /^@base-ui\/utils\/(store|platform)$/,
        replacement: resolve(
          workspace,
          "base-ui/packages/utils/src/$1/index.ts",
        ),
      },
      {
        find: /^@base-ui\/utils\/(.*)$/,
        replacement: resolve(workspace, "base-ui/packages/utils/src/$1.ts"),
      },
      {
        find: /^@\/registry\/bases\/base\/ui\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/registry/bases/base/ui/$1.tsx",
        ),
      },
      {
        // Both use the common authored Base components with this app's Nova
        // stylesheet. This is not a comparison of the generated Rhea preset.
        find: /^@\/styles\/(?:base-nova\/ui(?:-rtl)?|base-rhea\/ui)\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/registry/bases/base/ui/$1.tsx",
        ),
      },
      {
        find: /^@\/components\/ui\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/registry/bases/base/ui/$1.tsx",
        ),
      },
      {
        // Original authored Radix components, with this gallery's Nova CSS.
        // This is not a claim of generated Rhea theme parity.
        find: /^@\/styles\/radix-rhea\/ui\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/registry/bases/radix/ui/$1.tsx",
        ),
      },
      {
        find: "@/components/language-selector",
        replacement: resolve(
          workspace,
          "shadcn-ui/apps/v4/components/language-selector.tsx",
        ),
      },
      {
        find: "@/app/(create)/components/icon-placeholder",
        replacement: resolve(app, "icons.tsx"),
      },
      { find: "cn", replacement: resolve(app, "../cn.ts") },
      { find: "@/lib/utils", replacement: resolve(app, "../cn.ts") },
      {
        find: /^@shadcn\/react\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/packages/react/src/$1/index.ts",
        ),
      },
      {
        find: /^@shadcn\/helpers\/(.*)$/,
        replacement: resolve(
          workspace,
          "shadcn-ui/packages/helpers/src/$1/index.ts",
        ),
      },
      {
        find: /^@\/(.*)$/,
        replacement: resolve(workspace, "shadcn-ui/apps/v4/$1"),
      },
      ...[
        "react",
        "react-dom",
        "react-hook-form",
        "@babel/runtime",
        "@floating-ui/react-dom",
        "@floating-ui/utils",
        "use-sync-external-store",
        "reselect",
        "lucide-react",
        "@tabler/icons-react",
        "chrono-node",
        "cmdk",
        "date-fns",
        "embla-carousel-autoplay",
        "embla-carousel-react",
        "input-otp",
        "next-themes",
        "next",
        "react-day-picker",
        "react-resizable-panels",
        "react-textarea-autosize",
        "recharts",
        "sonner",
        "zod",
        "@tanstack/react-table",
        "class-variance-authority",
        "streamdown",
        "@streamdown/code",
        "motion",
        "radix-ui",
        "@ai-sdk/react",
        "ai",
        "@tanstack/ai-react",
        "@tanstack/ai-client",
        "@tanstack/ai",
      ].map((name) => ({ find: name, replacement: resolve(deps, name) })),
    ],
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "lucide-react",
      "@tabler/icons-react",
      "chrono-node",
      "cmdk",
      "date-fns",
      "date-fns/locale",
      "embla-carousel-autoplay",
      "embla-carousel-react",
      "input-otp",
      "next-themes",
      "next/dist/client/image-component",
      "next/dist/client/link",
      "react-day-picker",
      "react-day-picker/locale",
      "react-day-picker/persian",
      "react-resizable-panels",
      "react-textarea-autosize",
      "recharts",
      "sonner",
      "zod",
      "@tanstack/react-table",
      "class-variance-authority",
      "streamdown",
      "@streamdown/code",
      "motion",
      "radix-ui",
      "@ai-sdk/react",
      "ai",
      "@tanstack/ai-react",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5181,
    strictPort: true,
    hmr: false,
    ws: false,
    fs: { allow: [workspace] },
  },
});
