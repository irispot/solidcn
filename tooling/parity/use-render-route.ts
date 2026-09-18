import { useRender as nativeUseRender } from '../../base-ui/packages/solid/src/core';
import { adaptRenderProp, recordNativeExecution } from './fixture-renderer';

export function useRender(options: Record<string, any>) {
  recordNativeExecution('base-ui/packages/solid/src/core.tsx#useRender');
  return nativeUseRender(
    new Proxy(options, {
      get(target, key) {
        return key === 'render' ? adaptRenderProp(target.render) : Reflect.get(target, key);
      },
    }),
  );
}
