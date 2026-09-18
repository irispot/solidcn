import { createComponent } from 'solid-js';
import {
  CheckboxRootContext as NativeContext,
  type CheckboxRootState,
} from '../../base-ui/packages/solid/src/controls';
import { registerNative } from './fixture-renderer';

export type CheckboxRootContext = CheckboxRootState;

// The original part test supplies a root state without a DOM root.
// Supply that state to the shipped native context.
const Provider = registerNative(
  (props: { value: CheckboxRootState; children: unknown }) =>
    createComponent(NativeContext, {
      get value() {
        return { checked: () => props.value.checked, state: props.value };
      },
      get children() { return props.children; },
    }),
  'tooling/parity/checkbox-context-route.ts#CheckboxRootContext.Provider',
);

export const CheckboxRootContext = { Provider };
