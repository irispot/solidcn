# Exact React and Solid image comparison

This runner compares fresh browser screenshots. It does not approve an image as a new baseline. The React app imports components from the pinned original clones. The Solid app imports native source. React dependencies are isolated in `apps/reference`; neither distributed package needs React.

## Run

From the workspace root:

```sh
npm ci
npm run visual:setup
npx playwright install chromium
npm run verify:visual
```

The runner starts temporary servers on ports 5181 and 5182, then stops only the servers it started. Those ports must be free. If both apps already run, use:

```sh
npm run verify:visual -- --external
```

Run one case with:

```sh
npm run verify:visual -- --case shadcn-menu-open
```

The full report is `artifacts/visual/report.html`. It shows the original screenshot, the Solid screenshot, and changed pixels in red. `report.json` contains the evidence. A single-case run writes to `artifacts/visual/cases/<case-id>/` and does not replace the full report.

Use `--component accordion` or `--kind fixture` for a smaller run. `--offset 0 --limit 50` selects a batch. `--workers 4` runs four cases at a time; the default is one. A filtered run writes to `artifacts/visual/batches/`. Each run records its exact selection. `progress.json` gives a small, atomic progress record while the check runs. A partial or failed check is not a full-suite pass.

## Check the first popup frame

Start the two comparison apps with `npm run visual:dev`. In another terminal, run:

```sh
npm run verify:visual:popup-width
```

This check uses the shared documentation cases with an open action on the Combobox, Dropdown Menu, and Select pages. It currently selects 20 cases. Use `npm run verify:visual:popup-width -- --case docs-combobox-popup-open-combobox` for one case. The script needs the existing React app on port 5181 and Solid app on port 5182. It does not start or stop those apps. Restart `visual:dev` after a source edit; these preview apps have HMR disabled.

The browser records popup and trigger bounds and effective opacity on each animation frame, from before the trigger click. It repeats the check after Escape and a second click. The first visible frame has positive bounds and effective opacity above 0.01 through all ancestors. A Solid popup fails if its first visible width differs from the React width by more than 4 px or 1%, whichever is greater. When the React popup matches its trigger width, the Solid popup must also match its trigger width. A wider React Dropdown Menu is not forced to match its trigger. Frame traces, case IDs, both open results, and source fingerprints are in `artifacts/visual/first-popup-width.json`. A source change during the run fails the check. This checks opening width, not every animation property or exact static pixels.

## Check Drawer reopen

With the two comparison apps running, use `npm run verify:visual:drawer-reopen`. The check opens and cancels `docs-drawer-demo-default` three times in React and Solid, at desktop and mobile widths. It checks that closing releases the scroll lock and the trigger at once. It also checks that the portal and backdrop leave the page after the exit animation. The result and source fingerprints are in `artifacts/visual/drawer-reopen.json`. Restart `visual:dev` after a source edit.

## Check Drawer touch gestures

With the two comparison apps running, use `npm run verify:visual:drawer-touch`. This check uses real Chromium touch input on the mobile Drawer Dialog and Drawer Demo examples at 390 and 544 px. It checks that a downward drag moves the Drawer, closes it, and clears the modal layer. It checks that an upward drag scrolls the Drawer Demo content when that content can scroll. It also checks that a horizontal drag keeps the Drawer open and still. The result and source fingerprints are in `artifacts/visual/drawer-touch.json`. Restart `visual:dev` after a source edit.

With the two comparison apps running, use `npm run verify:visual:drawer-nested-close`. This check opens the first and second drawers in the original React and native Solid examples, then closes the second drawer. It records each animation frame at desktop and mobile widths. The parent drawer must clear its nested state and start to become visible within 80 ms of the React timing. The result and source fingerprints are in `artifacts/visual/drawer-nested-close.json`. Restart `visual:dev` after a source edit.

## Browse the example gallery

Start the main preview with `npm run dev`. In a second terminal, run `npm run visual:dev`. Then open [the local gallery](http://127.0.0.1:5173/tooling/visual/gallery.html).

The gallery lists every TSX example in the pinned Shadcn Base example directory, every documentation reference, local pasted examples, and shared component checks. This includes files that no documentation page links to. All entries have Solid, React, and side-by-side preview links. Each source loads separately. A failed conversion or missing dependency shows the selected example's error, not a substitute component.

The catalog currently contains 513 upstream files and two local files. It has 670 example states and 78 shared component states. `npm run visual:catalog` checks that no source or documentation reference is omitted. `npm run visual:audit` checks conversion status. Conversion status is not pixel or behavior proof. The gallery shows the last full pixel result separately and rejects that status if its source fingerprint is old or the run was invalid.

Gallery frames use a responsive host so both views fit their panels. The pixel runner does not use this gallery layout: it retains the fixed 900 by 700 viewport and configured fixture dimensions.

Select a state to see its action steps. Use the live controls to perform those steps. The gallery does not replace trusted browser input with synthetic events. With the gallery servers running, use `npm run verify:visual -- --external` for automatic action playback and pixel checks. Add `--case <case-id>` to check one state.

`visual:dev` keeps the two comparison apps on ports 5181 and 5182. It reuses matching existing apps and rejects an unrelated app on either port. On exit, it stops only servers that it started. The main preview remains separate. The comparison apps do not use HMR: an error in one selected example must not put a Vite error overlay on every other preview. Use Reload in the gallery after a source change.

Vite 8.3 still starts its browser transport with its WebSocket server disabled. A guarded preview plugin removes only those two transport-start calls in memory. The original Vite file is not edited. Its CSS helpers remain. HTTP failures, import failures, runtime errors, and console errors are not filtered. The gallery check verifies that a failed reference example does not cover another example and that no comparison transport opens.

## What the check proves

- Both apps use the same data, actions, fixture dimensions, neutral theme, and font.
- Reference components come from the original React source. Native components come from the new Solid packages. Loaded module paths are checked in both directions.
- The full 900 by 700 viewport is captured. Portals are not cropped out. Expected open popups must be visible and fully inside the viewport.
- States include open dropdowns, keyboard-highlighted menu items, open selects, filtered combobox results, open dialogs, and tooltip hover. Static cases include switch on/off/disabled, button focus/disabled, checkboxes, input, tabs, progress, and separator.
- Each app must produce two identical consecutive images before its result is compared with the other app.
- Every RGBA pixel is compared. There is no tolerance, anti-alias exclusion, mask, or ignored rectangle. A one-channel difference of one is a failure.
- Changed pixels, browser errors, unstable images, source changes during capture, and wrong source routing make the command fail.
- Original source and test files must remain unchanged. Source hashes, Git revisions, fixture actions, browser version, and coverage gaps are included in the report.

Reference CSS uses original assets; Solid CSS uses the native style entry. Common fixture layout and explicit theme inputs are separate from implementation styles. The reference resolves the registry editor's icon placeholder to real Lucide React icons. The Solid side uses its native SVG implementation, so geometry differences remain visible.

## Paste an example once

Put a React-style documentation example in `tooling/visual/examples/<name>.tsx`. Give it a default component export. Keep imports such as `@/components/ui/button`. Then run `npm run verify:visual`. No second Solid file is needed. Both apps use the same source file. The Solid app converts the supported React syntax in memory and imports the native packages. The original file is not changed.

The included `examples/pasted-button-group.tsx` is a small working example. Without a case file, the runner checks the initial state. For more states, add an adjacent `<name>.json`:

```json
{
  "component": "dropdown-menu",
  "states": [
    { "name": "default" },
    {
      "name": "open",
      "actions": [
        { "type": "click", "selector": "[aria-haspopup=menu]" },
        { "type": "wait", "selector": "[role=menu]" }
      ],
      "popups": ["[role=menu]"]
    }
  ]
}
```

Supported actions are `click`, `right-click`, `open`, `hover`, `focus`, `fill`, `press`, and `wait`. `open` clicks only when `aria-expanded` is not already true. Set `value` for `fill` or `press`. Selectors must select one target for actions; a `wait` uses the first match. Declare all expected open portals in `popups`. You can also set `width`, `height`, `direction`, `language`, `docUrl`, or an explicit `exportName` for a named component export.

The catalog also finds known imported trigger components in the source syntax and adds shared open-state recipes. These use real browser input and the original public `data-slot` attributes. They skip statically disabled trees. A hand-written sequence takes precedence when it names the same popup slot or declares `"covers": ["dropdown-menu"]` (use its actual trigger type). A shared role such as `dialog` is not enough to identify the component. Set `discoverInteractions: false` in one example's JSON only when its automatic recipe is unsuitable, and supply the required explicit states instead. The recipe name is recorded with each result. These recipes check the first enabled trigger, not every possible interaction or nested popup.

List case IDs with `npm run visual:list`. Run one with `npm run verify:visual -- --case local-pasted-button-group-default`.

`npm run visual:check` checks the image comparator and compiles all supported examples without starting a browser. Unsupported examples remain listed with exact errors. The screenshot runner records conversion errors per case, then continues with the remaining cases.

## Original documentation examples

The catalog combines `<ComponentPreview>` references with every TSX file in `shadcn-ui/apps/v4/examples/base`. All pages are included by default. `example-cases.json` adds exact open, submenu, typed-input, and keyboard sequences without changing those examples. Original tests remain protected and unchanged. The current catalog has 751 cases: 673 example states and 78 shared component checks. Direct Base UI fixture states cover 27 more modules, including open menus, dialogs, popovers, and preview cards. The fixtures do not claim complete state coverage for those modules.

Form and Sonner use two small framework adapters in `apps/reference/parity-scenarios.tsx` and `apps/solid/parity-scenarios.tsx`. The shared fixture defines the same input text, validation rule, toast message, and browser actions. The adapters only translate the different public state APIs. The React Form adapter imports the pinned Shadcn `new-york-v4` source and `react-hook-form`; the Solid adapter imports the native package. The React Sonner adapter imports the pinned `bases/base` source and Sonner engine; the Solid adapter uses the native Base UI toast manager. Exact screenshots for the configured states do not prove full engine parity.

List available pages with `npm run visual:list -- --docs`. To try another page, set the same environment variable for both apps and the runner:

```sh
SOLID_CN_DOC_PAGES=button-group,button npm run verify:visual
```

These are the actual example components, not a copy of the whole Next.js documentation site. The comparison frame uses the cloned theme values and local font files. The page header and navigation are outside this check.

The example converter is deliberately limited. Unsupported hooks, imports, or React patterns must produce an error. An untested page is not marked supported merely because its file exists. A valid conversion also does not prove behavior parity: the screenshot and action checks must pass.

## Limits

An exact match proves these pixels for these cases and this browser environment. It does not prove complete behavior, accessibility, all component states, touch behavior, other browsers, dark mode, or every style preset. Only the configured Nova preset is currently compared. Missing modules are listed, not marked passed.

Some original examples import `base-rhea` paths. Both comparison apps use the shared canonical component set under Nova for these examples. The converter checks the imported native names and records the source and target presets with `presetEquivalent: false`. These cases do not prove Rhea style parity.

Both implementations can share a design error if the common theme or fixture CSS is wrong. For example, pixel equality alone cannot prove that a switch thumb has enough contrast. Use the behavior checks and accessibility checks as separate requirements. The preview's checked-thumb CSS regression is checked separately.

The runner waits up to 2.5 seconds for finite animations and transitions to finish before it measures popup bounds. A timeout fails the case. It holds running infinite animations at time zero in both apps and records this policy with the result. An animation already paused by the source keeps its pose. Both screenshots retain that pose; they do not cancel and restart the animation. Text carets are hidden. This checks final static states, not later keyframes, speed, direction, or animation timing. Canvas, video, SVG motion, and JavaScript timers are not stopped; changing captures still fail. `node tooling/visual/check-capture.mjs` checks this capture policy. Add separate timing checks for transitions. Full migration parity remains false even if every configured visual case passes.

To add coverage, extend `fixtures.mjs` with a shared tree and action sequence. Add required portal selectors to `popups`. Do not change only the React side, remove a failing region, or increase a threshold to accept a migration error.
