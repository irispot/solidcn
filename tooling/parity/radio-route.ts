import { Radio as NativeRadio } from '../../base-ui/packages/solid/src/controls';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeRadio))
  registerNative(component, `base-ui/packages/solid/src/controls.tsx#Radio.${part}`);

export const Radio = NativeRadio;
