# Unchanged component suites and a native Solid adapter

Run `node tooling/parity/run-components.mjs` from the workspace root.

This separate configuration runs 19 original component files. It also imports the original createRenderer, describeConformance, and
component conformance helpers. None of these original files are changed.
The merge-props configuration is separate.

## Checked result

The jsdom run has 362 passed cases, zero failed cases, and eight original skipped cases:

| Original suite | Passed | Skipped |
| -------------- | -----: | ------: |
| Separator      |     18 |       0 |
| Button         |     23 |       1 |
| useRender      |     14 |       0 |
| FieldsetRoot   |     19 |       0 |
| FieldsetLegend |     19 |       2 |
| FieldDescription | 19 | 0 |
| Input          |     15 |       0 |
| AvatarRoot     |     15 |       0 |
| Toggle         |     22 |       0 |
| Meter: all five parts | 99 |     2 |
| Progress: all five parts | 99 | 3 |

The Button hover case already has `it.skipIf(isJSDOM)` in the original file.
The two FieldsetLegend server/hydration cases have the same original condition.
The five Meter/Progress layout cases also use original jsdom skip conditions.
The adapter adds no test skip and changes no assertion.

The generated files in `artifacts` contain the full Vitest JSON result, the full
console log, and an evidence summary. The summary records native function calls,
source SHA256 values before and after the run, suite counts, the original skip names, and diagnostic counts.
Source changes during the run fail the command. The runner clears the old JSON
result before it starts, so a runner failure cannot reuse a past passing result.
Run `node tooling/parity/preserve.mjs verify` for the separate source-file guard.

## Adapter boundary

- The compiler changes upstream fixture JSX into data descriptors in memory.
  It does not change assertions or write to the original files.
- Imports of React select the fixture runtime. This run does not load the React
  runtime. The fixture runtime does not contain component implementations.
- The selected routes register and export the actual native Solid functions.
  Fieldset fixtures also route their Field, Checkbox, CheckboxGroup, RadioGroup,
  and Slider imports. The useRender route calls the actual native public function.
- DOM creation uses Solid 2 RC.8 and `@solidjs/web`. DOM queries and user input
  use the actual Testing Library DOM and user-event packages.
- React render-element fixtures become Solid render callbacks. This conversion
  uses the shipped native `mergeProps`. React `className`, `htmlFor`, object refs,
  and capture handlers are mapped at the fixture DOM boundary.
- Same-type native component descriptors receive reactive props. A props change
  does not recreate that native component. The original stateful Button case
  confirms that the old DOM reference keeps focus after the disabled change.
- Unkeyed child arrays retain their owners by index. Explicit keys retain the
  same owner when their position changes. Removing an entry disposes its owner.
- Child creation is delayed until the native provider is active. Its cleanup
  belongs to the retained component, not a temporary DOM update effect. Each
  ordinary prop has a separate tracking scope. Synchronous `fireEvent` calls
  flush native updates before the original assertion executes.
- `useState`, `useRef`, and passive `useEffect` support the synchronous fixtures
  used here. Unsupported hooks throw an error. They do not silently do nothing.
- Each rendered case must execute a registered native function. The run records
  call counts and fails if a rendered case executes no native function.

Ten separate adapter diagnostics check nested native context, a reused child
descriptor under two providers, retained DOM, cleanup, live Fieldset legend IDs,
direct native rendering, indexed array retention and cleanup, and the legacy strict prop-key checker. Run them with:

```sh
npx vitest run --config tooling/parity/fixture-diagnostics.config.ts
```

These diagnostics are not original component assertions. A no-array-remount
case found a native legend-ID defect that the original array fixture could hide.
The native fix now keeps the same element while its registered ID changes.

## Limits

This is a narrow fixture bridge, not a React compatibility layer or proof that
all components have equal behavior. It does not cover React concurrent updates,
StrictMode, Suspense, class components, portals, React-created context, layout effects, SSR,
hydration, or type-test conversion. The keyed-list adapter covers original
fixture descriptor keys, not every React reconciliation edge case.
A fixture that returns a new native JSX getter from useRender can remount that getter on fixture updates.
Thus these cases do not prove general lifecycle or DOM-retention parity for
useRender. The separate native browser probe checks its retained DOM behavior.
The runtime now reads added and removed fixture prop keys through lazy reactive
accessors while it retains the component owner. The direct strict prop-key
diagnostic remains for its separate helper; it is not a runtime rejection test.

The development run emits strict-read warnings. They are retained in the full
log and counted in the evidence summary. In particular, `renderElement` reads
the fixture's reactive render prop during native component creation. This run
does not prove that changing that render prop later replaces the element.

The fixture hook bridge uses a stable hook order and microtasks for passive
effects. It does not reproduce the complete React scheduler or cleanup ordering.
Only the 19 named files and their helpers are selected. Other original suites
need explicit adapters and native behavior checks before their results can be
claimed.
