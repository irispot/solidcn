import { Separator as NativeSeparator } from '../../base-ui/packages/solid/src/structure';
import { registerNative } from './fixture-renderer';

// Return the actual component function; there is no alternate implementation.
export const Separator = registerNative(
  NativeSeparator,
  'base-ui/packages/solid/src/structure.tsx#Separator',
);
