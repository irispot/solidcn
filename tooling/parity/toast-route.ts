import { Toast as NativeToast } from '../../base-ui/packages/solid/src/notifications';
import { registerNative } from './fixture-renderer';

for (const [part, component] of Object.entries(NativeToast))
  if (typeof component === 'function')
    registerNative(component, `base-ui/packages/solid/src/notifications.tsx#Toast.${part}`);

export const Toast = NativeToast;
