import { createRenderer as baseCreateRenderer } from './select-client-fixture-entry';
import { flushMicrotasks } from './fixture-renderer';

export * from './select-client-fixture-entry';

// The original helper completes layout effects before render and user actions
// resolve. Drain the Solid registration cleanup and its dependent update here.
export function createRenderer(...args: Parameters<typeof baseCreateRenderer>) {
  const base = baseCreateRenderer(...args);
  return {
    ...base,
    async render(...renderArgs: Parameters<typeof base.render>) {
      const result = await base.render(...renderArgs);
      return {
        ...result,
        user: new Proxy(result.user, {
          get(target, key, receiver) {
            const member = Reflect.get(target, key, receiver);
            if (typeof member !== 'function') return member;
            return async (...eventArgs: unknown[]) => {
              const value = await member.apply(target, eventArgs);
              await flushMicrotasks();
              await flushMicrotasks();
              return value;
            };
          },
        }),
        async setProps(nextProps: Record<string, unknown>) {
          await result.setProps(nextProps);
          await flushMicrotasks();
          await flushMicrotasks();
        },
      };
    },
  };
}
