import { createComponent } from 'solid-js';
import {
  SwitchRootContext as NativeContext,
  type SwitchRootContext as NativeState,
} from '../../base-ui/packages/solid/src/controls';
import { registerNative } from './fixture-renderer';

export type SwitchRootContext = NativeState;

// The original part test supplies context without mounting a Switch root.
// This route uses the shipped native context and no replacement UI logic.
const Provider = registerNative(
  (props: { value: NativeState; children: unknown }) =>
    createComponent(NativeContext, {
      get value() { return props.value; },
      get children() { return props.children; },
    }),
  'tooling/parity/switch-context-route.ts#SwitchRootContext.Provider',
);

export const SwitchRootContext = { Provider };
