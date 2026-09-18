import { Switch as NativeSwitch } from '../../base-ui/packages/solid/src/controls';
import { registerNative } from './fixture-renderer';

// Route the unchanged upstream test to shipped Solid components.
for (const [part, component] of Object.entries(NativeSwitch))
  registerNative(component, `base-ui/packages/solid/src/controls.tsx#Switch.${part}`);

export const Switch = NativeSwitch;
