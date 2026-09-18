# Original test preservation and Solid parity

Run this command from the project root:

```sh
node tooling/parity/preserve.mjs verify
```

This check protects 543 Base UI files and 540 shadcn files from the original clones. It checks every recorded file against its SHA-256 digest and original Git blob. It also checks file type, executable permission, added files, deleted files, and staged changes. The original commits remain the comparison base when the port is committed. Test folders, fixtures, test utilities, snapshots, specification files, and runner configuration are included. Ignored dependency and build output files are excluded from the added-file check.

The original commits are recorded in `upstreams.json`. The digest list is `upstream-tests.sha256.json`. The `snapshot` command reads the original commits and prints the digest list. It does not change any files. Do not replace the list to accept changed tests.

Passing this check proves that the protected files are unchanged. It does not prove that a Solid component passes any original assertion. It does not run the React or Solid components.

## Run the same source tests in React and Solid

Run `npm run verify:dual` from the project root. The command runs the same 20 unchanged Base UI source test files in two modes: the pinned React source and the native Solid routes. It compares each file path, full assertion name, result, and skip status. It fails if a file or assertion is missing, if either run fails, if the results differ, if the original-file guard fails, or if source files change during the run.

The command also runs one selected assertion from the unchanged `SliderRoot.test.tsx` file in both modes: `does not link Slider.Label before hydration`. The other assertions in that file are filtered by the test name pattern. The report records them as filtered assertions; they are not parity skips. The Solid mode uses Solid `renderToString` in the fixture bridge and checks that the native `Slider.Root` function ran.

Run `npm run verify:dual:ssr-combobox` for three unchanged `ComboboxRoot.test.tsx` server assertions, `npm run verify:dual:ssr-navigation` for two unchanged `NavigationMenuContent.test.tsx` assertions, and `npm run verify:dual:ssr-select` for one unchanged `SelectRoot.test.tsx` assertion. Each command runs the same original file in pinned React and native Solid modes and compares assertion names and results. The Navigation Menu case found and fixed a native `keepMounted` server-render defect. Other tests in these files are filtered; these commands do not claim that they pass. Separate routed suites now run genuine Solid hydration for selected components. Unrouted hydration remains unsupported and fails clearly.

Read `artifacts/unchanged-selected-dual-evidence.json`, `artifacts/unchanged-combobox-ssr-comparison.json`, `artifacts/unchanged-navigation-ssr-comparison.json`, and `artifacts/unchanged-select-ssr-comparison.json` for assertion comparisons, input hashes, and native execution routes. A separate local Navigation Menu check verifies that kept server content is hidden; it does not replace any original assertion. The matching test files and the original `isJSDOM` skips remain unchanged. These runs cover 20 selected files and seven selected SSR assertions. They are not the full 325-file runtime suite required by the release gate.

Run `node tooling/parity/run-select-client.mjs` to execute every client case in
the unchanged `SelectRoot.test.tsx` file against both pinned React and native
Solid. The one server case is filtered here and runs in the separate SSR command.
This client command writes `artifacts/unchanged-select-client-comparison.json`.
It fails while Select assertion results differ; the report lists each mismatch.
Neither the original test nor its assertion helpers are changed.

Run `npm run verify:dual:select-parts` for all assertions in 14 more unchanged
Select part files. The command compares 220 passed React and Solid assertions
plus 11 matching original browser-only skips, with no case filter. It checks
each file, case identity, source route, native
execution, original-file protection, and source hashes before and after the
run. The report is `artifacts/unchanged-select-parts-comparison.json`. This is
Select-part evidence only; it does not cover the other original component
files or browser environments.

Run `node tooling/parity/run-shadcn-geometry.mjs` for the unchanged Shadcn
MessageScroller geometry test. It runs all 17 assertions against both the
pinned React module and its exact Solid-owned copy. The run checks the source
route, equal assertion results, stable inputs, and original-file protection.
The report is `artifacts/unchanged-shadcn-geometry-comparison.json`. It does
not prove MessageScroller component or browser parity.

Run `npm run verify:dual:shadcn-message-scroller` for the unchanged 49-case
MessageScroller component test file. React runs all 49 cases. Native Solid runs
44 client cases and five server or hydration cases, including two live
hydrations. The runner compares every case name and pass result, checks native
execution, and checks that the original test and native source stay stable.
The report is `artifacts/unchanged-shadcn-message-scroller-comparison.json`.
This is one test file in JSDOM; it does not prove full Shadcn behavior or
browser parity.

## Full React reference diagnostic

Run these commands from the project root:

```sh
npm ci --prefix tooling/parity/reference-deps --ignore-scripts --legacy-peer-deps
node tooling/parity/run-reference-all.mjs
```

The separate lock file installs the original React test dependencies that the
Solid workspace does not use. It does not change the root lock file. The runner
uses UTC, creates local package links in `node_modules`, and runs all unchanged
Base UI React `*.test.ts` and `*.test.tsx` files in JSDOM. It writes
`artifacts/unchanged-all-react-reference.json` and prints a short result. A
failure gives a nonzero exit code. This is a React baseline only. It does not
run Solid components and does not meet the release evidence gate.

On the current host, all 318 pinned Base UI files load: 9,134 assertions,
7,811 passed assertions, 3 failed
assertions, 1,319 original skips, and 1 original todo. The failures are focus checks in Dialog,
Popover, and FloatingFocusManager. The host uses Node 22.19.0 and Vitest 5;
the pinned Base UI project requires Node 22.23.2 or newer and uses Vitest
4.1.11. The cause of these three baseline failures is not yet known.

## Release evidence gate

Run `npm run verify:release`. This command must fail until the full evidence set exists. Changing `status.json` to say `passed` cannot make the command pass.

The command runs the original-file guard. It also checks tracked original source against each pinned commit. It then reads `artifacts/release-evidence.json` and checks the report file digests, current source and build output digests, suite coverage, test outcomes, native execution routes, public exports, type results, and packed consumer results. It checks the input digests and original-file guard again after validation. It does not run missing suites, build packages, or create acceptance evidence.

The current narrow test reports and export inventory are not release evidence. They lack full coverage and the required run digest. There is not yet a producer for the complete release evidence manifest. The release command thus fails correctly while the migration is incomplete.

The separate diagnostic uses synthetic reports only:

```sh
node tooling/parity/check-release-evidence.mjs
```

Its 29 fault cases include changed source, old reports, missing suites and cases, new skips, failed assertions, false counts, unused native routes, React implementation routes, wrong export value kinds, missing type results, and missing hydration checks. It does not read or change original test files.

### Evidence contract

`release-evidence.mjs` exports `collectReleaseInputs`, `releaseInputDigest`, `expectedSuites`, and `expectedApiModules` for future report producers. The producer must capture inputs before and after its complete run. Do not attach new digests to an old report.

- `schemaVersion` is `1`. `solidVersion` is `2.0.0-rc.8`. `startedAt` and `finishedAt` are ISO timestamps for the complete run.
- `inputsBefore` and `inputsAfter` are exact path-to-SHA256 maps from `collectReleaseInputs`, plus the two packed archive digests. They include all native source, client/server/declaration output, package manifests, the root lock file, build and package check tools, and all parity tools. Missing, extra, or changed entries fail. Build and pack the artifacts before this evidence interval. Keep the same archives for the consumer run.
- `runtime` contains `jsdom`, `chromium`, `firefox`, and `webkit`. Each has `reference`, `native`, and `routing` report references of the form `{ "path": "artifacts/name.json", "sha256": "..." }`.
- The two test reports use Vitest JSON result fields. Their assertion identities, occurrence counts, pass results, and original skips must match. Failed, todo, missing, or extra results fail. Each environment must report the full pinned runtime test-file inventory under both original `packages/react` trees. That is currently 325 files. The inventory comes from pinned metadata, not a hand-written coverage count.
- Each routing report binds `referenceSha256` and `nativeSha256` to its test reports. `suites` maps every original test path to `{ "nativeFiles": ["base-ui/packages/solid/src/example.tsx"], "nativeExecutions": 1 }`. Counts must come from the runner. Loading a native file without executing a native function is not sufficient. `originalImplementationFiles` and `reactRuntimeFiles` must be recorded empty arrays.
- `api` references a full public API report. Both `browser` and `server` have one row per root entry and public subpath from the pinned packages. Each row has `module`, `expected`, and `actual`. Export shape entries have `name` and `kind`; namespace members must use qualified names. Expected shapes must come from the original source/runtime, not from the port. Missing values and wrong value kinds fail. Extra native helper exports are allowed. Types are checked separately.
- `types` references a report with `exitCode: 0`, `diagnostics: []`, all `originalSpecs`, and one explicit `mappings` row per original spec. Each row has `original`, a positive `assertions` count, `failed: 0`, and `unsupported: 0`. There are currently 41 original type files. A Solid compiler check alone does not supply the React-to-Solid public type mapping proof.
- `packages` references a packed-consumer report. It must include all current `verify-packages.mjs` checks for both source and compiled exports, including server HTML, browser actions, and hydration node retention. `archiveHashes` lists the two distinct `.tgz` paths and their current digests. A passed flag with recorded errors fails.
- Routing, API, type, and packed-consumer reports each have their own `startedAt`, `finishedAt`, and `runInputsSha256`. That digest is `releaseInputDigest` of the complete input map. A report with an old digest cannot be reused with a new manifest.

This gate checks the evidence structure, content, and current digests. It is not a signed external attestation. Review the evidence producers and their source-routing logic. Do not create hand-written reports to satisfy the gate. Passing this gate also does not turn a screenshot comparison into an assertion about animation timing or every accessibility case.

## Original runners

The versions below come from the package manifests at the pinned commits.

| Base UI runner part           | Version            |
| ----------------------------- | ------------------ |
| Node.js engine                | `>=22.23.2`        |
| pnpm                          | `12.4.1`           |
| Vitest                        | `4.1.11`           |
| Vite                          | `8.2.2`            |
| `@vitest/browser-playwright`  | `4.1.11`           |
| `@playwright/test`            | `1.62.1`           |
| jsdom                         | `27.4.0`           |
| `@mui/internal-test-utils`    | `2.0.18-canary.25` |
| `@testing-library/react`      | `16.3.2`           |
| `@testing-library/dom`        | `10.4.1`           |
| `@testing-library/user-event` | `14.6.3`           |
| `@testing-library/jest-dom`   | `7.0.1`            |
| React and React DOM           | `19.2.8`           |
| `@vitejs/plugin-react`        | `6.1.1`            |
| `vitest-browser-react`        | `2.3.0`            |

Base UI runs its unit suites with `pnpm test:jsdom` and `pnpm test:chromium`. The root also defines browser regression, end-to-end, screen reader, public type, and package checks. These commands currently select the original React implementation. Running them does not validate the Solid package.

The Base UI contribution guide gives older toolchain versions. Use the pinned package manifest values above.

The shadcn root declares Vitest `^3.2.6` and Vite `^7.3.2`. Its `@shadcn/react` package uses React and React DOM `19.2.3`, jsdom `^28.1.0`, Playwright `^1.61.0`, `@vitest/browser` `^3.2.6`, and `vite-tsconfig-paths` `^4.3.2`. Its browser suites use Chromium. Registry tests cover configuration and calendar data. They do not provide a behavior suite for every styled UI component. The separate React package has message scroller and questionnaire suites.

## What unchanged Solid parity needs

Original Base UI tests import `react`, use React hooks inside fixture components, construct React elements, and call React rendering helpers. Their test helpers also use React element cloning and React-specific lifecycle behavior. A module alias from `@base-ui/react` to a Solid package is insufficient.

These parts need separate adapters or transforms outside the original test files:

- **Source selection:** Route public imports and relative source imports to the native Solid implementation. Prove that no original React component supplied the tested behavior.
- **Fixture rendering:** Execute unchanged fixture components that use React hooks, children, contexts, refs, and element cloning. React fixture updates must update existing Solid component instances. A global React-to-Solid import replacement does not preserve those semantics.
- **Test helpers:** Preserve the original conformance assertions, pointer helpers, fake clock behavior, and cleanup. The current `createRenderer` wraps the React renderer from `@mui/internal-test-utils`. Replacing it with a helper that omits assertions would not prove parity.
- **Component composition:** Preserve shared context through compound components, render props, portals, nested roots, and custom fixture components. Extra wrapper elements can change DOM assertions, focus, CSS, and accessibility.
- **Events and refs:** Match controlled updates, native and synthetic event behavior, default prevention, callback timing, callback refs, object refs, and ref cleanup.
- **Scheduling and lifecycle:** Account for `act`, `flushMicrotasks`, fake timers, Strict Mode, Suspense, transitions, and unmount cleanup. React lifecycle assertions can require a documented framework-specific mapping.
- **Server rendering:** Route server rendering and hydration to Solid. A React host wrapper around a client-only Solid island cannot prove the original server assertions.
- **Type assertions:** Original `.spec.tsx` files assert React public types. Preserve the files, but report React-type compatibility separately from Solid runtime and Solid JSX type correctness.

A valid parity report must state which unchanged suites executed, which native Solid modules they loaded, how many assertions passed or failed, and which suites could not run. Keep unsupported suites visible. Do not label an unchanged React baseline, component export count, compilation result, or digest check as Solid behavior parity.

The supplied guard proves original file preservation only. A complete adapter for unchanged React component fixtures is not implemented in this folder. An independently routed utility suite is not a component parity result.

## Native Solid selection checks

The Select, Combobox, and Autocomplete implementations use Solid `2.0.0-rc.8`. They share native Solid state and context. Positioning uses `@floating-ui/dom`. They do not load React.

Direct Chromium checks passed for these behaviors. Run `node tooling/verify-selection.mjs` against the running preview server to repeat them. Set `SOLID_CN_URL` if the preview uses another address. The script constructs browser modules in memory and saves results to `artifacts/selection-verification.json`. No original test file was added or changed.

- Select opens, chooses an item, updates a controlled value, and retains its display label after the popup closes.
- Combobox filters with typed text and selects the highlighted option with Arrow Down and Enter.
- Multiple selection adds and removes chips. Form data contains one entry per selected value.
- Object values work with a custom equality function. A `caf` query matches `Café`.
- Autocomplete with automatic highlighting converts `wa` to `Water` when Enter is pressed.
- Autocomplete `both` mode displays the keyboard-highlighted label while filtering with the typed query. Pointer hover keeps that temporary value; an external controlled update replaces it. `inline` mode keeps the full list and permits typing after the temporary value.
- Select aligns the selected item with the trigger. The checked vertical center difference was zero pixels.
- A modal Select locks document scrolling and restores it after close. The shared lock supports nested owners.
- `actionsRef.unmount()` removes an explicitly retained closed popup.
- A CSS exit animation keeps the closed popup mounted until the animation completes.
- A required Select inherits its Field name, label, description, and errors. Blur sets `aria-invalid`; selection clears it and supplies the expected form value.

These checks do not establish unchanged upstream component-test parity. Remaining selection work includes virtualized collection navigation, grid navigation, and exact selected-item alignment through transformed ancestors. The original browser, server-rendering, and type suites still need complete framework adapters. In Solid, `useFilteredItems()` returns an accessor; call it to read the current array.
