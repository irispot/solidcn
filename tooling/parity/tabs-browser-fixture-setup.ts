import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';

(globalThis as typeof globalThis & { BASE_UI_ANIMATIONS_DISABLED?: boolean })
  .BASE_UI_ANIMATIONS_DISABLED = true;

// The original test uses MUI's console matcher. This small transport matcher
// keeps that assertion without loading MUI's React renderer in the Solid run.
expect.extend({
  async toErrorDev(callback: () => unknown, expected?: string | readonly string[]) {
    const calls: string[] = [];
    const original = console.error;
    console.error = (...values: unknown[]) => {
      calls.push(values.map(String).join(' '));
    };
    try {
      await callback();
    } finally {
      console.error = original;
    }
    const messages = expected === undefined ? [] :
      typeof expected === 'string' ? [expected] : [...expected];
    const pass = messages.length
      ? messages.every((message) => calls.some((call) => call.includes(message)))
      : calls.length > 0;
    return {
      pass,
      message: () => `Expected console.error to match ${JSON.stringify(messages)}; received ${JSON.stringify(calls)}.`,
    };
  },
});
