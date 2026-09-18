import { AbstractChat, type ChatInit, type ChatState, type ChatStatus, type UIMessage } from 'ai';
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';

// The protocol, stream decoder, tool handling, request queue, and cancellation
// stay in the installed framework-independent AI SDK AbstractChat engine.
class SolidChatState<Message extends UIMessage> implements ChatState<Message> {
  private readonly messageState;
  private readonly statusState = createSignal<ChatStatus>('ready');
  private readonly errorState = createSignal<Error | undefined>(undefined);

  constructor(messages: Message[] = []) {
    this.messageState = createSignal<Message[]>(messages);
  }

  get messages() {
    return this.messageState[0]();
  }
  set messages(messages: Message[]) {
    this.messageState[1]([...messages]);
  }
  get status() {
    return this.statusState[0]();
  }
  set status(status: ChatStatus) {
    this.statusState[1](status);
  }
  get error() {
    return this.errorState[0]();
  }
  set error(error: Error | undefined) {
    this.errorState[1](error);
  }
  pushMessage = (message: Message) => {
    this.messages = [...this.messages, message];
  };
  popMessage = () => {
    this.messages = this.messages.slice(0, -1);
  };
  replaceMessage = (index: number, message: Message) => {
    this.messages = [
      ...this.messages.slice(0, index),
      this.snapshot(message),
      ...this.messages.slice(index + 1),
    ];
  };
  snapshot = <T>(value: T): T => structuredClone(value);
}

export class Chat<Message extends UIMessage = UIMessage> extends AbstractChat<Message> {
  constructor({ messages, ...options }: ChatInit<Message> = {}) {
    super({ ...options, state: new SolidChatState<Message>(messages) });
  }
}

type UseChatOptions<Message extends UIMessage> = (ChatInit<Message> | { chat: Chat<Message> }) & {
  resume?: boolean;
  experimental_throttle?: number;
};

export function useChat<Message extends UIMessage = UIMessage>(
  options: UseChatOptions<Message> = {},
) {
  if (options.experimental_throttle)
    throw new Error('The native docs AI adapter does not implement experimental_throttle.');
  const chat = untrack(() =>
    'chat' in options
      ? options.chat
      : new Chat<Message>({
          ...options,
          onToolCall: (value) => options.onToolCall?.(value),
          onData: (value) => options.onData?.(value),
          onFinish: (value) => options.onFinish?.(value),
          onError: (value) => options.onError?.(value),
          sendAutomaticallyWhen: (value) => options.sendAutomaticallyWhen?.(value) ?? false,
        }),
  );
  createEffect(
    () => options.resume ?? false,
    (resume) => {
      if (resume) void chat.resumeStream();
    },
  );
  onCleanup(() => {
    void chat.stop();
  });
  return {
    get id() {
      return chat.id;
    },
    get messages() {
      return chat.messages;
    },
    get status() {
      return chat.status;
    },
    get error() {
      return chat.error;
    },
    setMessages(messages: Message[] | ((current: Message[]) => Message[])) {
      chat.messages =
        typeof messages === 'function' ? messages(untrack(() => chat.messages)) : messages;
    },
    sendMessage: chat.sendMessage,
    regenerate: chat.regenerate,
    stop: chat.stop,
    resumeStream: chat.resumeStream,
    clearError: chat.clearError,
    addToolResult: chat.addToolOutput,
    addToolOutput: chat.addToolOutput,
    addToolApprovalResponse: chat.addToolApprovalResponse,
  };
}
