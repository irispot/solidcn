# Solid control migration status

These controls use `solid-js@2.0.0-rc.8` and `@solidjs/web@2.0.0-rc.8`.
They do not use the React runtime. The source is in `src/controls.tsx`.

The package has native implementations and public import paths for Button,
Input, Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, Toggle, ToggleGroup,
Field, Fieldset, Form, NumberField, Slider, Meter, Progress, and OTPField.
The component namespaces include the parts from the source repository.
Public props and state type names are available from each control import path.

## Verification

Start the workspace development server. From the workspace root, run:

```sh
node tooling/verify-controls.mjs
npm run typecheck
node tooling/parity/preserve.mjs verify
```

The browser script checks these operations in Chromium:

- Checkbox state changes keep the same DOM node and keyboard focus.
- Named checkbox inputs produce form data and return to their default on reset.
- CheckboxGroup selection updates its value array.
- Arrow keys select a radio. A read-only radio group rejects changes.
- OTP bulk input fills four slots and calls the completion callback.
- NumberField reads `3,5` as `3.5` with the `pt-BR` locale.
- Form blocks an empty required email, then submits a valid address.
- Form reset clears field value, dirty state, touched state, and validation state.
- Slider push behavior keeps the required gap between two values.
- A disabled custom Button does not call its click callback.
- Group and Fieldset disabled state takes precedence over child settings.
- Fieldset has an accessible name from its Legend.

Additional focused Chromium checks verified these operations:

- External controlled values update Field dirty and filled state, Form semantic
  values, and custom validation. The checks cover Input, Checkbox, Switch,
  CheckboxGroup, RadioGroup, NumberField, Slider, and OTPField.
- An explicit Field.Root ID stays on the root only. Its generated control ID is
  different, and Field.Label points to that control.
- RadioGroup and ToggleGroup keep one enabled child in the tab order. Radio
  arrow navigation skips disabled children. External radio selection and a
  change to a child's disabled state update the tab stop. Toggle arrow navigation
  moves focus without changing its selected values.

The unchanged upstream Button suite also runs through the external Solid fixture
adapter in `tooling/parity/components.config.ts`. The source fixes include
keyboard click modifier flags, native and custom disabled attributes, disabled
pointer and mouse handlers, and focusable disabled buttons. The fixture adapter
translates the React test fixtures; the component under test is native Solid.

The public `merge-props` port passes all 35 tests in the original
`packages/react/src/merge-props/mergeProps.test.ts` file. The file is unchanged.
Run it from the workspace root with:

```sh
./node_modules/.bin/vitest run --config tooling/parity/vitest.config.ts
```

These checks do not prove full behavior parity. The complete React component
test suites have not passed against these Solid components. The protected test
files remain unchanged.

## Known differences and remaining work

- `render` uses a Solid render function. It does not accept a pre-created React
  element. Event callbacks receive native DOM events.
- Several detailed event reason types currently use `string`. All upstream
  reason values and callback ordering rules have not been verified.
- A Field uses its first registered control as its primary control. Changing an
  explicit control ID, replacing the primary control, or using multiple custom
  controls can require more label, focus, and registration handling. A control's
  explicit ID is not yet registered as the Field.Label target.
- Indicator and Field.Error mounting does not implement the full upstream exit
  animation lifecycle or transition state. Server error changes do not yet focus
  the first invalid field automatically.
- RadioGroup and ToggleGroup support roving tab stops. Nested-group and dynamic
  child handling still need comparison with the complete upstream keyboard suite.
- NumberField ScrubArea does not implement pointer lock or cursor teleportation.
  Its `teleportDistance` prop has no effect. Long-press modifier keys and all
  locale parsing cases have not been verified.
- Slider supports pointer movement, keyboard input, ranges, push/swap/none
  collision modes, and measured edge alignment. Push behavior at range limits,
  gap enforcement during swaps, pointer-to-thumb offset preservation, and dynamic
  thumb insertion/reordering still differ from the complete upstream algorithm.
  The upstream pre-hydration layout script is not included.
- OTPField supports input, paste, composition, masking, slot focus, character
  filtering, and completion. All selection, deletion, first-slot accessible-name,
  autofill, and auto-submit ordering cases have not been verified against the
  upstream suite.
- Meter and Progress do not include every upstream screen-reader workaround.
  In particular, the extra presentation text used for some NVDA versions is not
  included.

Use this package as a migration in progress. Do not treat passing browser
checks or unchanged test files as evidence of complete Base UI compatibility.
