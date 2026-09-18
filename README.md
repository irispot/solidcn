# Solid CN

This workspace contains native Solid 2 RC packages built from cloned Base UI and Shadcn repositories.

Clone with `git clone --recurse-submodules https://github.com/irispot/solidcn.git`.
The [source branch and rebase guide](REBASE.md) has direct GitHub diff links for
each port and explains how to review a new upstream commit.

**Status: experimental and incomplete.** The public runtime export inventory is covered, but public type and full behavior parity are not established. Selected original component suites run against Solid through a separate fixture adapter. The other original suites still need this work. A passing build, exact gallery images, a complete runtime export list, and unchanged test files do not prove equivalent behavior. Do not treat this as a completed migration or a verified drop-in replacement.

## Packages

| Package             | Source                     | Purpose                                                     |
| ------------------- | -------------------------- | ----------------------------------------------------------- |
| `@solid-cn/base-ui` | `base-ui/packages/solid`   | Native Solid primitives, without a React runtime.           |
| `@solid-cn/ui`      | `shadcn-ui/packages/solid` | Shadcn components and styles built on the Solid primitives. |

Both packages require exactly `solid-js@2.0.0-rc.8` and `@solidjs/web@2.0.0-rc.8`. The compiler is also pinned to RC.8. Do not install Solid 1 with these packages.

The inventory covers 43 public Base UI module paths, excluding internal paths and the types-only path. It also covers all 62 component files in Shadcn's Base UI registry and the legacy `form` component. The Shadcn Next.js documentation site, CLI, and React-only example blocks are retained as upstream reference files; they are not converted applications.

## Develop and check

Use Node.js 22.19 or newer. Run commands from this directory, not from a cloned upstream root.

```sh
npm ci
npm run typecheck
npm run build
npm run verify:tests
npm run verify:upstream
npm run verify:dual
npm run dev
```

With the preview running, use a second terminal:

```sh
npm run verify:browser
node tooling/verify-controls.mjs
node tooling/verify-selection.mjs
node tooling/verify-shadcn.mjs
node tooling/verify-render.mjs
node tooling/verify-navigation.mjs
node tooling/inventory.mjs
node tooling/verify-packages.mjs
```

If Chromium is not installed, run `npx playwright install chromium` first. The browser scripts are additional checks. They do not replace or modify upstream test files.

`npm run build` emits native browser JavaScript, server JavaScript, source maps, and TypeScript declarations. It also checks the protected upstream files. `npm run build:preview` builds the example application.

## Use in another project

After a successful build, `node tooling/verify-packages.mjs` creates two package archives in `artifacts/`. It installs them into an isolated temporary project and checks TypeScript, a production Vite build, and server rendering.

Install both archives in your project. Replace the paths with their actual locations:

```sh
npm install /path/to/solid-cn-base-ui-0.0.0-rc.0.tgz /path/to/solid-cn-ui-0.0.0-rc.0.tgz solid-js@2.0.0-rc.8 @solidjs/web@2.0.0-rc.8
```

Use `@solidjs/vite-plugin@3.0.0-next.43` with Vite 8. Set TypeScript `jsx` to `preserve` and `jsxImportSource` to `@solidjs/web`.

```tsx
import { Button } from '@solid-cn/ui/button';
import { Dialog } from '@solid-cn/base-ui/dialog';

export function Example() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={(props) => <Button {...props} />}>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Example</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Solid render props use functions. Replace React `render={<Button />}` with `render={props => <Button {...props} />}`. The primitives are unstyled; use the Shadcn dialog parts for default styling.

For Shadcn, install Tailwind CSS 4 and include:

```css
@import 'tailwindcss';
@import '@solid-cn/ui/styles.css';
@source './node_modules/@solid-cn/ui/src';
```

Adjust the `@source` path relative to your CSS file. Add `class="style-nova"` to `<html>` or `<body>` so styles also apply to portal content. Eight style presets are included. See the Shadcn package README for other presets and the native chart, calendar, and form APIs.

Neither package has been published to npm.

## Original tests

The source submodules are pinned in `tooling/parity/upstreams.json`. The checksum guard compares 1,083 original test files, fixtures, helpers, snapshots, and runner configuration files against those Git commits. None may be changed, deleted, or replaced. Normal source commits in your local clones are allowed.

The 35 original `mergeProps` tests run unchanged against the Solid utility through a separate Vitest resolver. These are utility tests, not component parity tests.

Selected original component files run through separate client, browser, server-render, and hydration adapters. Some routed suites pass in both React and Solid; others still fail in Solid. The adapters do not change the original test files. See the current artifacts and `tooling/parity/status.json` for the release state. Passing selected suites is not proof of full component parity.

The remaining original component suites import React, ReactDOM, React testing helpers, and framework-specific fixtures. They need more fixture routes. No adapter currently provides full execution of every suite against Solid. The adapter maps React element fixtures to native Solid render functions; this does not add React element support to the distributed package. See `tooling/parity/README.md` for its limits.

`npm run verify:dual` runs the original baseline files in both frameworks. More `verify:dual:*` commands run selected unchanged tests for additional families in JSDOM and Chromium, with separate real server-render and hydration checks. Review each command's case count and skips; selected checks do not cover the full original suite. The Solid bridge calls Solid's server renderer and hydrator for the routed cases. React is a root development dependency for the reference runner, not a dependency of either Solid package.

## Remaining work

- Run the original component tests against Solid through an explicit adapter, with the test bytes unchanged. Resolve all failures and record the full result.
- Match advanced Base UI behavior, including virtualized/grid selection, nested navigation and content transitions, drawer snap points and nested gestures, and exact overlay timing and pointer interactions.
- Complete precise public prop types and check every callback ordering rule. Custom `useRender` state mappings have native browser checks, but full upstream coverage is still required.
- Verify all exported parts in real browsers, including nested overlays, touch input, RTL, screen readers, and server hydration. Current browser checks cover selected scenarios only.
- Complete or document the remaining differences in the replacements for Recharts, React Day Picker, React Hook Form, CMDK, Sonner, and other React-only engines. These replacements do not implement every upstream option.
- The additional `verify-selection.mjs` probe currently fails its immediate-Escape/manual-unmount assertion. It assumes synchronous mouse opening. The upstream Select opens after one animation frame; the native Select now uses that timing. Separate checks that wait for the popup confirm selection, focus return, and Escape behavior. The probe and original tests were not changed to hide this result.
- `npm run verify:browser` stops at an older local check that asks for a Number Field `spinbutton`. The pinned React Number Field input has a `textbox` role, which the native input now matches. This local check remains unchanged under the test-file freeze.
- `npm run verify:gallery` waits for an error in a documentation example that now renders. The local check still assumes the older unsupported state and remains unchanged under the test-file freeze.

The [control notes](base-ui/packages/solid/CONTROLS.md) and [Shadcn notes](shadcn-ui/packages/solid/README.md) list more specific limits. `npm run verify:release` fails while the full parity result is missing. An export-coverage result is not a release approval.

The upstream MIT licenses are retained in each clone and copied into the new packages.

## Pixel comparison and upstream updates

The visual runner loads the original React source and native Solid source in separate browser apps. It includes open menus, selects, filtered comboboxes, dialogs, hover states, and keyboard states. Full viewport screenshots include content rendered through portals.

For interactive browsing, start `npm run dev` and `npm run visual:dev` in separate terminals. Open [the example gallery](http://127.0.0.1:5173/tooling/visual/gallery.html). It lists all 513 upstream Base-style Shadcn example files, including 55 files not linked in the documentation. The local pasted example, a Base UI anchored-toast example, and shared checks are also included. Every entry has Solid, React, and side-by-side views. Unsupported examples show their own error. Conversion status and pixel results are separate.

```sh
npm run visual:setup
npm run verify:visual
npm run upstream:status
npm run upstream:compare -- base-ui HEAD
npm run upstream:check
npm run upstream:candidate -- shadcn-ui HEAD
```

The image comparison uses exact RGBA values, with zero tolerance and no hidden regions. Each image must also match a repeated capture from its own app. The report records source hashes, original commits, loaded module paths, and missing coverage. It fails on changed pixels, browser errors, unstable captures, or source edits during the run. Open `artifacts/visual/report.html` for the original, Solid, and difference images. See `tooling/visual/README.md` for limits and per-case commands.

For documentation checks, paste a React-style example once into `tooling/visual/examples/<name>.tsx`. Both apps read that file. The Solid app converts supported syntax in memory. Shared recipes add open states for known triggers. An optional adjacent JSON file adds exact clicks, keyboard input, and expected open popups. `npm run visual:list` lists all case IDs. `npm run visual:catalog` checks that every upstream example is visible. `npm run visual:audit` reports conversion gaps. Unsupported code fails clearly; it is not counted as a pass. See [the example workflow](tooling/visual/README.md#paste-an-example-once).

The original tracked source and tests have zero diff. New code lives in separate native packages and root tooling. The read-only upstream tool reports changed source and tests, affected native modules, and modules that import them. This limits Git merge conflicts; it does not automatically translate new React behavior into Solid. See `tooling/upstream/README.md` before any update. Historical migration scripts must not overwrite the current port.

The candidate workflow regenerates supported modules from exact upstream Git blobs and small, checked overrides. It writes only to a new temporary folder. `npm run upstream:check` reports the current exact-replay and manual-review counts. A successful replay check is not behavior approval. Replace `HEAD` with an existing local candidate ref to review a new revision. The tool does not fetch, rebase, or apply changes.
