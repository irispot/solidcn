import { ChatClient, type ChatClientOptions, type UIMessage } from '@tanstack/ai-client';
import { createEffect, createSignal, createUniqueId, onCleanup, untrack } from 'solid-js';

type Options = ChatClientOptions<any, any> & {
  live?: boolean;
  outputSchema?: unknown;
};

// ChatClient owns the AG-UI protocol, stream processing, tools, persistence,
// and connection state. This layer only exposes its state to Solid readers.
export function useChat(options: Options) {
  let publish = () => {};
  const client = untrack(
    () =>
      new ChatClient({
        ...options,
        id: options.id ?? createUniqueId(),
        onResponse: (response) => options.onResponse?.(response),
        onChunk: (chunk) => options.onChunk?.(chunk),
        onFinish: (message) => options.onFinish?.(message),
        onError: (error) => options.onError?.(error),
        onCustomEvent: (type, data, context) => options.onCustomEvent?.(type, data, context),
        onMessagesChange: () => publish(),
        onLoadingChange: () => publish(),
        onErrorChange: () => publish(),
        onStatusChange: () => publish(),
        onSubscriptionChange: () => publish(),
        onConnectionStatusChange: () => publish(),
        onSessionGeneratingChange: () => publish(),
      }),
  );
  const [revision, setRevision] = createSignal(0);
  publish = () => {
    setRevision((value) => value + 1);
  };
  const read = <T>(value: () => T) => {
    revision();
    return value();
  };
  const structuredPart = () =>
    read(() => {
      const messages = client.getMessages();
      const userIndex = messages.findLastIndex((message) => message.role === 'user');
      if (userIndex < 0) return null;
      for (let index = messages.length - 1; index > userIndex; index--) {
        const message = messages[index];
        if (message.role !== 'assistant') continue;
        const part = message.parts.find((part) => part.type === 'structured-output');
        if (part) return part;
      }
      return null;
    });
  createEffect(
    () => ({
      body: options.body,
      forwardedProps: options.forwardedProps,
      context: options.context,
      tools: options.tools,
    }),
    (next) => {
      client.updateOptions(next);
    },
  );
  createEffect(
    () => options.live ?? false,
    (live) => {
      if (live) client.subscribe();
      else client.unsubscribe();
    },
  );
  onCleanup(() => {
    publish = () => {};
    client.stop();
    client.dispose();
  });
  return {
    get messages() {
      return read(() => client.getMessages());
    },
    get isLoading() {
      return read(() => client.getIsLoading());
    },
    get error() {
      return read(() => client.getError());
    },
    get status() {
      return read(() => client.getStatus());
    },
    get isSubscribed() {
      return read(() => client.getIsSubscribed());
    },
    get connectionStatus() {
      return read(() => client.getConnectionStatus());
    },
    get sessionGenerating() {
      return read(() => client.getSessionGenerating());
    },
    get partial() {
      const part = structuredPart();
      return part?.partial ?? part?.data ?? {};
    },
    get final() {
      const part = structuredPart();
      return part?.status === 'complete' ? part.data : null;
    },
    sendMessage: (message: Parameters<typeof client.sendMessage>[0]) => client.sendMessage(message),
    append: (message: Parameters<typeof client.append>[0]) => client.append(message),
    reload: () => client.reload(),
    stop: () => client.stop(),
    clear: () => client.clear(),
    setMessages: (messages: UIMessage[]) => client.setMessagesManually(messages),
    addToolResult: (result: Parameters<typeof client.addToolResult>[0]) =>
      client.addToolResult(result),
    addToolApprovalResponse: (response: Parameters<typeof client.addToolApprovalResponse>[0]) =>
      client.addToolApprovalResponse(response),
  };
}
