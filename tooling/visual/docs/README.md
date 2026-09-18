# Original documentation examples

The Vite plugin reads the original Shadcn example files and local pasted TSX files. It does not write a second Solid copy. The React app loads each original source file without a source transform. The Solid app uses an in-memory AST transform.

`docsExamplesPlugin({ framework: 'solid' | 'react' })` exports these virtual modules:

- `virtual:solid-doc-examples` or `virtual:react-doc-examples`: `examples`, `cases`, `catalog`, and `transformations`.
- `virtual:solid-doc-example/<catalog-name>` or the React equivalent: one example. Catalog names include `docs/button-group-demo` and `local/pasted-button-group`.

The default catalog comes from `../example-catalog.mjs`. A caller can supply `examples` and `cases` options for an isolated check. `SOLID_CN_DOC_PAGES` selects comma-separated documentation pages, or `*`. Files added to or removed from `tooling/visual/examples`, sidecar JSON changes, and original source changes cause a catalog reload. Invalid examples cause a visible error; they are not omitted.

## Transform contract

`transformExample(code, filename, options)` returns `{ code, map, metadata }`. It uses TypeScript symbols to keep state references separate from variables with the same name in a different scope.

Supported inputs are:

- React namespace, default, and named/aliased `useState` imports. State initializers run once. State reads become Solid accessor calls; setters remain native signal setters.
- Shadcn imports from `@/components/ui/*`, `@/styles/base-nova/ui/*`, and `ui-rtl/*`, plus Base UI subpath imports. These use the native package. RTL direction still must be supplied by the fixture host.
- `render={<Element ... />}`. The result is a Solid function that merges behavior props, explicit attributes, classes, and event handlers.
- JSX `className`, `htmlFor`, `tabIndex`, React keys, and boolean data/ARIA attributes.
- Named Lucide and Tabler icon imports. Literal SVG data is read from the isolated reference packages. No React code is imported by the native icons.
- The documentation `useTranslation` helper. An explicit native context adapter preserves Arabic as the default language and supports language changes. Translation text stays in the original example.

Other React hooks, React namespace values/spreads, indirect hook copies, unknown imports, function-valued render props, and unsupported icon data fail with a source location. This is not a general React compiler. In particular, React lifecycle effects, refs, context APIs, arbitrary component prop destructuring, and React render-time control flow need separate, reviewed transforms before use. Do not infer coverage of other documentation pages from the ButtonGroup result.

Direct state reads during component setup also fail with a source location. This includes `const doubled = count * 2`, `const props = { disabled }`, `if (open) return ...`, and a state-dependent conditional return expression. These would run only once in Solid. State reads inside JSX expressions and nested functions are allowed: for example, `{count * 2}` and `onClick={() => setCount(count + 1)}`.

This check follows direct state references, not arbitrary data flow or function calls. It does not prove that an allowed nested function will be called in a reactive context. For example, a derived value obtained by calling a helper during component setup still needs a reviewed transform. Prop-derived values, arbitrary render-time branches, and other React update patterns are not covered. Add behavior cases for each pasted example; successful compilation alone is not sufficient.

Run `node tooling/visual/docs/check-transform.mjs` for compiler, icon-data, binding-scope, and rejection checks. The visual runner provides separate browser and pixel evidence. Compiler success alone does not prove behavior or pixel parity.

The current ButtonGroup scope is all 12 `ComponentPreview` examples in the original MDX page, including nested, dropdown, select, popover, and RTL examples. Native icon data currently comes from `lucide-react@0.474.0` (ISC) and `@tabler/icons-react@3.31.0` (MIT). Their license files remain in the isolated reference installation.
