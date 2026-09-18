import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { animate } from 'motion';
import { Bubble, BubbleContent } from '@solid-cn/ui/bubble';
import { Message, MessageContent } from '@solid-cn/ui/message';
import { MessageScrollerItem } from '@solid-cn/ui/message-scroller';
import { omitProps } from '../../../../shadcn-ui/packages/solid/src/utils';
import {
  MESSAGE_ANIMATIONS,
  type MessageAnimationPreset,
} from '../../../../shadcn-ui/apps/v4/lib/message-animations';

export type MessageAnimatedMessage = {
  id: string;
  role: string;
  text?: string;
  parts?: ReadonlyArray<{ type: string; text?: unknown; content?: unknown }>;
};
type Props = {
  message: MessageAnimatedMessage;
  animationPreset?: MessageAnimationPreset;
  assistantVariant?: string;
  userVariant?: string;
  scrollAnchor?: boolean;
  [key: string]: any;
};

function contentParts(message: MessageAnimatedMessage) {
  if (message.parts)
    return message.parts.flatMap((part, index) => {
      const type =
        part.type === 'reasoning' || part.type === 'thinking'
          ? 'reasoning'
          : part.type === 'text'
            ? 'text'
            : null;
      const text =
        typeof part.text === 'string'
          ? part.text
          : typeof part.content === 'string'
            ? part.content
            : null;
      return type && text !== null ? [{ key: `${message.id}-${index}`, text, type }] : [];
    });
  return typeof message.text === 'string'
    ? [{ key: `${message.id}-text`, text: message.text, type: 'text' }]
    : [];
}

// Exact Brain paths from lucide-react 0.474.0 (ISC), used by the original helper.
function BrainIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-brain size-3.5"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

export function MessageAnimated(props: Props) {
  let element: HTMLElement | undefined;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const [reduced, setReduced] = createSignal(query.matches);
  const updateReduced = () => setReduced(query.matches);
  query.addEventListener('change', updateReduced);
  onCleanup(() => query.removeEventListener('change', updateReduced));
  const user = () => props.message.role === 'user';
  const parts = createMemo(() => contentParts(props.message));
  createEffect(
    () => ({
      user: user(),
      preset: props.animationPreset ?? MESSAGE_ANIMATIONS['slide-up'],
      reduced: reduced(),
    }),
    (value) => {
      if (!element || !value.user) return;
      const { transition, ...target } = value.preset.variants.animate;
      const initial = value.preset.variants.initial as Record<string, any>;
      const frames = Object.fromEntries(
        Object.entries(target).map(([name, target]) => [
          name,
          value.reduced ? target : [initial[name] ?? target, target],
        ]),
      );
      if (initial.originX !== undefined || initial.originY !== undefined)
        element.style.transformOrigin = `${(initial.originX ?? 0.5) * 100}% ${(initial.originY ?? 0.5) * 100}%`;
      const playback = animate(
        element,
        frames,
        value.reduced ? { duration: 0 } : { ...transition },
      );
      return () => playback.stop();
    },
  );
  return (
    <MessageScrollerItem
      messageId={props.message.id}
      scrollAnchor={props.scrollAnchor ?? (user() ? true : undefined)}
      {...omitProps(props, [
        'message',
        'animationPreset',
        'assistantVariant',
        'userVariant',
        'scrollAnchor',
        'ref',
      ])}
      ref={(node: HTMLElement) => {
        element = node;
        if (typeof props.ref === 'function') props.ref(node);
      }}
    >
      <Message align={user() ? 'end' : 'start'}>
        <MessageContent>
          {parts().map((part) => {
            const paragraphs = part.text
              .split(/\n\s*\n/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean);
            return part.type === 'reasoning' ? (
              <div class="w-full border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
                <div class="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <BrainIcon />
                  Reasoning
                </div>
                <div class="space-y-1.5 text-sm">
                  {paragraphs.map((paragraph) => (
                    <p class="whitespace-pre-wrap">{paragraph}</p>
                  ))}
                </div>
              </div>
            ) : (
              <Bubble
                variant={
                  (user()
                    ? (props.userVariant ?? 'muted')
                    : (props.assistantVariant ?? 'ghost')) as any
                }
              >
                <BubbleContent className="space-y-2">
                  {paragraphs.map((paragraph) => (
                    <p class="whitespace-pre-wrap">{paragraph}</p>
                  ))}
                </BubbleContent>
              </Bubble>
            );
          })}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
