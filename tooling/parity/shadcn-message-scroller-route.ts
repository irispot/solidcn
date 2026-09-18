import {
  MessageScroller as NativeMessageScroller,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from '../../shadcn-ui/packages/solid/src/internal/message-scroller';
import { registerNative } from './fixture-renderer';

export const MessageScroller = Object.fromEntries(
  Object.entries(NativeMessageScroller).map(([part, component]) => [
    part,
    registerNative(
      component,
      `shadcn-ui/packages/solid/src/internal/message-scroller.tsx#MessageScroller.${part}`,
    ),
  ]),
) as typeof NativeMessageScroller;

export { useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility };
