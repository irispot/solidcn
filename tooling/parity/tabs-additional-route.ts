import { CSPProvider as NativeCSPProvider } from '../../base-ui/packages/solid/src/core';
import { registerNative } from './fixture-renderer';

export const CSPProvider = registerNative(
  NativeCSPProvider,
  'base-ui/packages/solid/src/core.tsx#CSPProvider',
);
