import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const urls = {
  react: process.env.SOLID_CN_REACT_VISUAL_URL ?? 'http://127.0.0.1:5181',
  solid: process.env.SOLID_CN_SOLID_VISUAL_URL ?? 'http://127.0.0.1:5182',
};

const scenarios = [
  {
    id: 'docs-input-otp-controlled-default',
    steps: [
      { name: 'empty' },
      { name: 'partial', fill: '123' },
      { name: 'complete', fill: '123456' },
    ],
  },
  {
    id: 'docs-input-otp-pattern-default',
    steps: [
      { name: 'empty' },
      { name: 'reject letters', fill: 'abc' },
      { name: 'accept digits', fill: '123456' },
    ],
  },
  {
    id: 'docs-input-otp-demo-default',
    steps: [
      { name: 'default value' },
      { name: 'replace value', fill: '654321' },
    ],
  },
  {
    id: 'docs-input-otp-disabled-default',
    steps: [{ name: 'disabled' }],
  },
];

function snapshot(page) {
  return page.evaluate(() => {
    const input = document.querySelector('input[data-slot="input-otp"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('InputOTP is missing');
    const container = input.closest('[data-input-otp-container]');
    return {
      value: input.value,
      valueAttribute: input.getAttribute('value'),
      focused: document.activeElement === input,
      disabled: input.disabled,
      pattern: input.getAttribute('pattern'),
      inputMode: input.getAttribute('inputmode'),
      spellcheck: input.getAttribute('spellcheck'),
      placeholderShown: input.getAttribute('data-input-otp-placeholder-shown'),
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      selectionStartAttribute: input.getAttribute('data-input-otp-mss'),
      selectionEndAttribute: input.getAttribute('data-input-otp-mse'),
      slots: [...(container?.querySelectorAll('[data-slot="input-otp-slot"]') ?? [])].map(
        (slot) => ({ text: slot.textContent, active: slot.getAttribute('data-active') }),
      ),
      controlledFeedback: document.querySelector('.text-center.text-sm')?.textContent?.trim() ?? null,
    };
  });
}

const browser = await chromium.launch({ headless: true });
let checks = 0;
try {
  for (const scenario of scenarios) {
    const pages = {};
    for (const framework of ['react', 'solid']) {
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
      await page.goto(`${urls[framework]}/?case=${scenario.id}`);
      await page.locator('input[data-slot="input-otp"]').waitFor();
      pages[framework] = page;
    }
    try {
      for (const step of scenario.steps) {
        if (step.fill !== undefined)
          for (const page of Object.values(pages))
            await page.locator('input[data-slot="input-otp"]').fill(step.fill);
        for (const page of Object.values(pages)) await page.waitForTimeout(80);
        const react = await snapshot(pages.react);
        const solid = await snapshot(pages.solid);
        assert.deepEqual(solid, react, `${scenario.id}: ${step.name}`);
        checks++;
        console.log(`PASS ${scenario.id}: ${step.name}`);
      }
    } finally {
      await Promise.all(Object.values(pages).map((page) => page.close()));
    }
  }
} finally {
  await browser.close();
}
console.log(`InputOTP dual browser result: ${checks}/${checks} DOM and behavior states match.`);
