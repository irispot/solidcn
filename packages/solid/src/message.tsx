import { dataValue } from './utils';
// Native Solid 2 port of the upstream Base UI registry.
import {
  createSignal,
  createMemo,
  createEffect,
  createContext,
  useContext,
  createUniqueId,
  type Component,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from './utils';
import { cn } from './utils';
function MessageGroup(__props0: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-group"
      class={cn('cn-message-group flex min-w-0 flex-col', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function Message(
  __props1: ComponentProps<'div'> & {
    align?: 'start' | 'end';
  },
) {
  return (
    <div
      data-slot="message"
      data-align={dataValue(__props1.align === undefined ? 'start' : __props1.align)}
      class={cn(
        'cn-message group/message relative flex w-full min-w-0 data-[align=end]:flex-row-reverse',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className', 'align'])}
    />
  );
}
function MessageAvatar(__props2: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-avatar"
      class={cn(
        'cn-message-avatar flex w-fit shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function MessageContent(__props3: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-content"
      class={cn(
        'cn-message-content flex w-full min-w-0 flex-col wrap-break-word',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function MessageHeader(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-header"
      class={cn(
        'cn-message-header flex max-w-full min-w-0 items-center',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function MessageFooter(__props5: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-footer"
      class={cn(
        'cn-message-footer flex max-w-full min-w-0 items-center group-data-[align=end]/message:justify-end',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader };
