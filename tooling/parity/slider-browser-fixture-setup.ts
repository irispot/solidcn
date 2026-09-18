import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';

// The browser fixture does not load MUI's React matcher plugin. These two
// assertions use browser output directly and keep the unchanged test intact.
expect.extend({
  async toWarnDev(run: () => unknown, expected: string | readonly string[]) {
    const warnings: string[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnings.push(args.map(String).join(' '));
    });
    try {
      await run();
    } finally {
      warn.mockRestore();
    }
    const messages = Array.isArray(expected) ? expected : [expected];
    const pass = messages.every((message) => warnings.some((warning) => warning.includes(message)));
    return { pass, message: () =>
      `Expected warnings ${JSON.stringify(messages)}; received ${JSON.stringify(warnings)}` };
  },
  toHaveComputedStyle(element: Element, expected: Record<string, string>) {
    const style = getComputedStyle(element);
    const differences = Object.entries(expected)
      .filter(([key, value]) => (style as unknown as Record<string, string>)[key] !== value)
      .map(([key, value]) => `${key}: expected ${value}, received ${(style as unknown as Record<string, string>)[key]}`);
    return { pass: differences.length === 0, message: () => differences.join('; ') ||
      `Expected the computed style not to match ${JSON.stringify(expected)}` };
  },
});
