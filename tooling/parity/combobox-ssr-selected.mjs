export const comboboxSsrTestFile =
  "base-ui/packages/react/src/combobox/root/ComboboxRoot.test.tsx";
export const comboboxSsrTestName = "server-side rendering";
export const comboboxSsrAssertions = [
  "sets combobox aria attributes on the input",
  "sets combobox aria attributes on the trigger when input is inside popup",
  "does not link Combobox.Label to trigger before hydration",
];
