import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { transformExample } from "./transform.mjs";
import { adaptAsyncComponents } from './async-source.mjs';
import { fixExampleInputs } from './example-input-fixes.mjs';
import { readIconDefinitions, generateIconModule } from "./icons.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(here, "../../..");

/** One unchanged source catalog, with explicit native transforms only for Solid. */
export function docsExamplesPlugin(options = {}) {
  const framework = options.framework ?? "solid";
  if (!["solid", "react"].includes(framework))
    throw new Error(`Unsupported docs framework: ${framework}`);
  const virtualName = `virtual:${framework}-doc-examples`;
  const prefix = `virtual:${framework}-doc-example/`;
  const virtualRoot = resolve(here, `.virtual-${framework}`);
  // Solid's JSX compiler skips null-prefixed IDs. Only the plain-JS catalog
  // uses that prefix; example and icon modules must retain .tsx file-shaped IDs.
  const virtualId = (name) =>
    `${name === "catalog.ts" ? "\0" : ""}${resolve(virtualRoot, name)}`;
  const paths = new Map();
  const keys = new Map();
  const iconPaths = new Map();
  const transformed = new Map();
  const loaded = new Set();
  let catalog;
  let cases;
  let catalogPromise;
  async function prepare() {
    if (!catalogPromise)
      catalogPromise = (async () => {
        if (options.examples) {
          catalog =
            typeof options.examples === "function"
              ? await options.examples()
              : options.examples;
          cases = options.cases ?? [];
        } else {
          const discovery = await import("../example-catalog.mjs");
          const requestedPages = process.env.SOLID_CN_DOC_PAGES;
          const catalogOptions =
            options.catalogOptions ??
            (requestedPages
              ? {
                  pages:
                    requestedPages === "*" ? "*" : requestedPages.split(","),
                }
              : undefined);
          catalog = await discovery.getExampleCatalog(catalogOptions);
          cases = await discovery.getExampleCases(catalogOptions);
        }
        const names = new Set();
        for (const entry of catalog) {
          if (
            !entry.name ||
            names.has(entry.name) ||
            (!entry.discoveryError && (!entry.source || !entry.exportName))
          )
            throw new Error(
              "Example catalog requires unique names, source paths, and explicit export names.",
            );
          names.add(entry.name);
          const key = createHash("sha256")
            .update(entry.name)
            .digest("hex")
            .slice(0, 24);
          keys.set(key, entry);
          paths.set(virtualId(`example-${key}.tsx`), { entry, key });
          for (const kind of ["lucide", "tabler"])
            iconPaths.set(virtualId(`icons-${key}-${kind}.tsx`), {
              entry,
              key,
              kind,
            });
        }
      })();
    await catalogPromise;
  }
  async function convert(entry, key) {
    if (entry.discoveryError) throw new Error(entry.discoveryError);
    if (!transformed.has(entry.name)) {
      const source = await readFile(entry.source, "utf8");
      const result = transformExample(
        source,
        entry.source,
        options.transformOptions,
      );
      // Each example owns its icon exports. Loading another example cannot
      // reuse an earlier icon module with an incomplete export set.
      result.code = result.code.replace(
        /(["'])virtual:solid-doc-icons\/(lucide|tabler)\1/g,
        (_, quote, kind) =>
          JSON.stringify(`virtual:solid-doc-icons/${key}/${kind}`),
      );
      transformed.set(entry.name, result);
    }
    return transformed.get(entry.name);
  }
  let refreshTimer;
  async function refresh(server) {
    catalogPromise = undefined;
    transformed.clear();
    paths.clear();
    keys.clear();
    iconPaths.clear();
    try {
      await prepare();
      for (const id of loaded) {
        const module = server.moduleGraph.getModuleById(id);
        if (module) server.moduleGraph.invalidateModule(module);
      }
      server.ws.send({ type: "full-reload" });
    } catch (error) {
      server.config.logger.error(error.stack ?? error.message);
      server.ws.send({
        type: "error",
        err: {
          message: error.message,
          stack: error.stack,
          plugin: `solid-cn-original-docs-${framework}`,
        },
      });
    }
  }
  return {
    name: `solid-cn-original-docs-${framework}`,
    enforce: "pre",
    async transform(code, id) {
      if (framework !== 'react' || !id.endsWith('.tsx')) return;
      await prepare();
      if (!catalog.some((entry) => entry.source === id)) return;
      const input = fixExampleInputs(code, id);
      const bridged = adaptAsyncComponents(input.code, id, 'react');
      if (input.fixes.length || bridged.components.length) return {code: bridged.code, map: null};
    },
    async resolveId(source) {
      if (source === virtualName) {
        await prepare();
        return virtualId("catalog.ts");
      }
      if (source.startsWith(prefix)) {
        await prepare();
        const key = source.slice(prefix.length);
        const entry = keys.get(key);
        if (!entry) throw new Error(`Unknown example key: ${key}`);
        return framework === "react"
          ? entry.source
          : virtualId(`example-${key}.tsx`);
      }
      if (framework === "solid") {
        if (source === "virtual:solid-doc-source/new-york-card")
          return virtualId("new-york-card.tsx");
        if (/^virtual:solid-doc-adapter\/[\w-]+$/.test(source)) {
          const name = source.split("/").at(-1);
          const extension = [
            'async',
            "environment",
            "otp-patterns",
            "ai-sdk",
            "ai-tanstack",
          ].includes(name)
            ? "ts"
            : "tsx";
          return resolve(here, `adapters/${name}.${extension}`);
        }
        if (source === "virtual:solid-doc-runtime")
          return resolve(here, "runtime.ts");
        if (source === "virtual:solid-doc-language")
          return resolve(here, "language-selector.tsx");
        if (source.startsWith("virtual:solid-doc-icons/")) {
          const [key, kind] = source
            .slice("virtual:solid-doc-icons/".length)
            .split("/");
          if (!keys.has(key) || !["lucide", "tabler"].includes(kind))
            throw new Error(`Unknown example icon module: ${source}`);
          return virtualId(`icons-${key}-${kind}.tsx`);
        }
      }
    },
    async load(path) {
      if (!path.startsWith(virtualRoot) && path !== virtualId("catalog.ts"))
        return;
      if (path === virtualId("new-york-card.tsx")) {
        const original = resolve(
          workspace,
          "shadcn-ui/apps/v4/registry/new-york-v4/ui/card.tsx",
        );
        return transformExample(await readFile(original, "utf8"), original)
          .code;
      }
      loaded.add(path);
      await prepare();
      if (path === virtualId("catalog.ts")) {
        const manifest = Object.fromEntries(
          [...keys].map(([key, entry]) => [
            entry.name,
            {
              exportName: entry.exportName,
              source: entry.sourceRelative ?? entry.source,
              error: entry.discoveryError ?? null,
              moduleUrl:
                framework === "react"
                  ? `/@fs${entry.source}`
                  : `/@id/${prefix}${key}`,
            },
          ]),
        );
        return `
export const cases = ${JSON.stringify(cases)};
export const catalog = ${JSON.stringify(catalog)};
const manifest = ${JSON.stringify(manifest)};
const pending = new Map();
export async function loadExample(name) {
  const entry = manifest[name];
  if (!entry) throw new Error("Example is not in the catalog: " + name);
  if (entry.error) throw new Error(entry.source + ": " + entry.error);
  if (!pending.has(name)) pending.set(name, (async () => {
    const module = await import(/* @vite-ignore */ entry.moduleUrl);
    const component = module[entry.exportName];
    if (!component || (typeof component !== "function" && typeof component !== "object"))
      throw new Error(entry.source + ": missing component export " + entry.exportName);
    return component;
  })());
  return pending.get(name);
}
`;
      }
      if (framework === "solid" && paths.has(path)) {
        const { entry, key } = paths.get(path);
        if (entry.source) this.addWatchFile(entry.source);
        try {
          return await convert(entry, key);
        } catch (error) {
          // A selected example can fail without making the catalog or any
          // other example fail. The app renders this exact diagnostic.
          return `throw new Error(${JSON.stringify(error.message ?? String(error))});`;
        }
      }
      if (framework === "solid" && iconPaths.has(path)) {
        const { entry, key, kind } = iconPaths.get(path);
        const result = await convert(entry, key);
        const names = result.metadata.icons[kind];
        const definitions = await readIconDefinitions(
          kind,
          names,
          options.dependencies ??
            resolve(workspace, "tooling/visual/apps/reference/node_modules"),
        );
        for (const definition of definitions)
          this.addWatchFile(definition.source);
        return { code: generateIconModule(kind, definitions), map: null };
      }
    },
    configureServer(server) {
      const examples = resolve(workspace, "tooling/visual/examples");
      const settings = resolve(workspace, "tooling/visual/example-cases.json");
      const catalogSource = resolve(
        workspace,
        "tooling/visual/example-catalog.mjs",
      );
      const documentation = resolve(
        workspace,
        "shadcn-ui/apps/v4/content/docs/components/base",
      );
      const sourceExamples = resolve(
        workspace,
        "shadcn-ui/apps/v4/examples/base",
      );
      server.watcher.add([
        examples,
        settings,
        catalogSource,
        documentation,
        sourceExamples,
      ]);
      const changed = (path) => {
        if (!(
          path === settings ||
          path === catalogSource ||
          (path.startsWith(`${examples}/`) && /\.(?:tsx|json)$/.test(path)) ||
          (path.startsWith(`${documentation}/`) && path.endsWith(".mdx")) ||
          catalog?.some((entry) => entry.source === path)
        ))
          return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void refresh(server);
        }, 25);
      };
      for (const event of ["add", "unlink", "change"])
        server.watcher.on(event, changed);
      server.httpServer?.once("close", () => {
        clearTimeout(refreshTimer);
        for (const event of ["add", "unlink", "change"])
          server.watcher.off(event, changed);
      });
    },
  };
}
export default docsExamplesPlugin;
