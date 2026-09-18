# Visual reference apps

These apps load the source from the two cloned repositories. They do not use a
released Base UI package or a React wrapper around the Solid implementation.

From the workspace root:

```sh
npm install --prefix tooling/visual/apps/reference --ignore-scripts
npm run dev --prefix tooling/visual/apps/reference
npm run dev --prefix tooling/visual/apps/solid
```

The reference app uses port 5181. The Solid app uses port 5182. The optional Vite
flags `--host`, `--port`, and `--strictPort` can follow `--` in each start command.
React 19.2.8 and its reference-only dependencies are installed under
`apps/reference/node_modules`. They are not dependencies of the workspace or
either distributed Solid package.

Both apps use `/?case=<id>`. The shared case list and component trees are in
`../fixtures.mjs`. The original documentation and pasted-example case list comes
from `../example-catalog.mjs`, exposed through a Vite virtual module. The host is
`#visual-case`, normally 600 by 240 CSS pixels for diagnostic fixtures.
Open popups can render outside this host. Capture the full 900 by 700 viewport
to include menus, dialogs, and other portals.

The apps set `window.__visualReady` after mounting and expose
`window.__visualMeta`. Its module list comes from actual browser resource loads.
The screenshot runner also records module response URLs. A selected example
that cannot load or render shows a visible diagnostic, sets `window.__visualError`,
and leaves `window.__visualReady` false. Unknown case IDs do not select a fallback.

All discovered examples can be selected. Availability does not mean that a
native conversion is complete. `virtual:react-doc-examples` and
`virtual:solid-doc-examples` expose `loadExample(name)`, `catalog`, and `cases`.
The catalog contains data only. Each source file is imported or converted only
when its loader is called. An unsupported example does not stop other examples.
Each native example also has separate icon modules, so their exports cannot
collide in the browser cache. The dynamic module URLs are Vite development-server
URLs; these reference apps are development tools, not production app bundles.

The native transform supports JSX fragments and removes type-only imports from
its runtime output. This does not produce native public type declarations.
Date helpers use the pinned, framework-neutral `date-fns` package. The pinned
`react-day-picker/locale` entry is its direct re-export, so it maps to the same
date-fns locale module. Basic `sonner` toast calls use the existing native toast
manager. Sonner's `Toaster` and APIs or options without a native mapping remain
explicit errors. This does not establish Sonner visual or full API parity.

The optional `gallery=1` URL flag makes the host fit its iframe. The screenshot
runner does not use this flag and retains its fixed reference dimensions.

## Reference inputs

- The React app loads `base-ui/packages/react/src` and
  `shadcn-ui/apps/v4/registry/bases/base/ui` directly.
- The Solid app loads `base-ui/packages/solid/src` and
  `shadcn-ui/packages/solid/src` directly.
- Reference styles use the original Shadcn Tailwind variants and Nova stylesheet.
  Solid styles use its exported `styles.css` entry. Each app scans only its own
  component source for utility classes. Both also scan the original example
  sources and local examples for their shared example-level classes.
- Layout, unstyled Base UI fixture CSS, Arial font, and explicit neutral design
  tokens are shared. The comparison does not validate every theme or font.
- Documentation and local examples use the exact light theme declarations read
  from the cloned `app/globals.css`, plus the Geist, Geist Mono, Noto Sans Arabic,
  and Noto Sans Hebrew families configured in the cloned `lib/fonts.ts`. Font
  files come from pinned Fontsource 5.3.0 packages, not a live Google Fonts fetch.
  Both apps load the same font bytes. This does not verify the deployed site's
  current font-file revision.
- The React example loader imports the original example files unchanged. The
  Solid loader transforms those same files in memory. It does not create a
  second editable example. Native imports resolve to native component source.
- The cloned documentation refers to generated `styles/base-nova/ui` paths.
  The reference app resolves these to their original canonical registry source.
  RTL examples use the shared original example direction and Arabic content.
  Generated RTL-specific component rewrites are not separately verified.
- `cn.ts` supplies the framework-neutral class-name helper expected by the
  original Shadcn registry. Switch and Button use the exact original components.
- The original icon placeholder depends on the Next.js design-system editor.
  `reference/icons.tsx` selects its real Lucide React icon, as a registry install
  with Lucide selected would do. The Solid side uses its own local SVG icon
  implementation. Icon geometry differences are therefore visible. Other icon
  libraries and the design-system editor itself are outside this comparison.

Do not fix a component difference by changing only one app's fixture tree or
style. Keep original source and test files unchanged.
