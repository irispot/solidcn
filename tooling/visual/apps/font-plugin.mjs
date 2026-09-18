import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const require = createRequire(
  new URL("./reference/package.json", import.meta.url),
);
const loadFont =
  require("next/dist/compiled/@next/font/dist/google/loader").default;
const fontPostcss =
  require("next/dist/build/webpack/loaders/next-font-loader/postcss-next-font").default;
const postcss = require("postcss");
const prefix = "/__visual/fonts/";

/** Run the pinned original Next font compiler once; both renderers use its bytes. */
export function visualFontPlugin(framework) {
  const assets = new Map();
  let prepared;
  const prepare = () =>
    (prepared ??= (async () => {
      if (framework === "solid") {
        const response = await fetch(
          `http://127.0.0.1:5181${prefix}module.json`,
        );
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      }
      const result = await loadFont({
        functionName: "Vazirmatn",
        data: [{ subsets: ["arabic"] }],
        isDev: false,
        isServer: true,
        emitFontFile: (buffer, extension) => {
          const path = `${prefix}${createHash("sha256").update(buffer).digest("hex")}.${extension}`;
          assets.set(path, buffer);
          return path;
        },
      });
      const exports = [];
      const compiled = await postcss(
        fontPostcss({ ...result, exports }),
      ).process(result.css, { from: undefined });
      const className = `visual-font-${createHash("sha256").update(compiled.css).digest("hex").slice(0, 12)}`;
      return {
        css: compiled.css.replaceAll(".className", `.${className}`),
        className,
        style: exports.find((entry) => entry.name === "style").value,
      };
    })());
  return {
    name: "original-next-font-service",
    enforce: "pre",
    resolveId(id) {
      if (id === "next/font/google" || id === "virtual:visual-next-google-font")
        return "\0visual-next-google-font";
    },
    async load(id) {
      if (id !== "\0visual-next-google-font") return;
      const font = await prepare();
      return `const font = ${JSON.stringify(font)};
        const style = document.createElement('style'); style.textContent = font.css; document.head.append(style);
        export function Vazirmatn(options) {
          if (JSON.stringify(options) !== JSON.stringify({subsets:['arabic']})) throw new Error('This font fixture requires the original Vazirmatn options.');
          return {className: font.className, style: font.style};
        }`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url, "http://127.0.0.1").pathname;
        if (!path.startsWith(prefix)) return next();
        try {
          if (framework === "solid") {
            const response = await fetch(`http://127.0.0.1:5181${path}`);
            res.statusCode = response.status;
            res.setHeader(
              "Content-Type",
              response.headers.get("content-type") ??
                "application/octet-stream",
            );
            res.end(Buffer.from(await response.arrayBuffer()));
            return;
          }
          const font = await prepare();
          if (path === `${prefix}module.json`) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(font));
          } else if (assets.has(path)) {
            res.setHeader(
              "Content-Type",
              path.endsWith(".woff2") ? "font/woff2" : "font/woff",
            );
            res.end(assets.get(path));
          } else {
            res.statusCode = 404;
            res.end("Unknown font asset");
          }
        } catch (error) {
          res.statusCode = 500;
          res.end(`Original font compiler failed: ${error.message}`);
        }
      });
    },
  };
}
