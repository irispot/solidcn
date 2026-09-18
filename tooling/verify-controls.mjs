import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Browser diagnostics for the Solid port. The original upstream tests are not
// copied or changed. Start the workspace development server before this script.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(process.env.BASE_UI_URL ?? 'http://localhost:5173');
  const result = await page.evaluate(async () => {
    const source = await (await fetch('/base-ui/packages/solid/src/controls.tsx')).text();
    const webPath = source.match(/from "([^"]+@solidjs_web[^\"]+)"/)[1];
    const solidPath = source.match(/from "([^"]+solid-js[^\"]+)"/)[1];
    const { render, createComponent: component, spread } = await import(webPath);
    const { flush } = await import(solidPath);
    const controls = await import('/base-ui/packages/solid/src/controls.tsx');
    const root = document.createElement('section');
    document.body.append(root);
    const result = {};
    function mount(Component, props, tag = 'div') {
      const container = document.createElement(tag);
      root.replaceChildren(container);
      const dispose = render(() => component(Component, props), container);
      flush();
      return { container, dispose };
    }

    let app = mount(controls.Checkbox.Root, { name: 'flag', defaultChecked: false }, 'form');
    const checkbox = app.container.querySelector('[role=checkbox]');
    checkbox.focus();
    checkbox.click();
    flush();
    result.checkbox = {
      stable: checkbox.isConnected,
      focused: checkbox === document.activeElement,
      checked: checkbox.getAttribute('aria-checked'),
      data: Array.from(new FormData(app.container)),
    };
    app.container.reset();
    await Promise.resolve();
    flush();
    result.reset = app.container.querySelector('input').checked;
    app.dispose();

    let values = [];
    app = mount(controls.CheckboxGroup, {
      onValueChange: (value) => {
        values = value;
      },
      get children() {
        return ['a', 'b'].map((value) =>
          component(controls.Checkbox.Root, { value, children: value }),
        );
      },
    });
    app.container.querySelectorAll('[role=checkbox]')[1].click();
    flush();
    result.checkboxGroup = values;
    app.dispose();

    let selected;
    app = mount(controls.RadioGroup, {
      defaultValue: 'a',
      onValueChange: (value) => {
        selected = value;
      },
      get children() {
        return ['a', 'b'].map((value) =>
          component(controls.Radio.Root, { value, children: value }),
        );
      },
    });
    const radio = app.container.querySelector('[role=radio]');
    radio.focus();
    radio.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    flush();
    result.radio = {
      selected,
      states: Array.from(app.container.querySelectorAll('[role=radio]')).map((node) =>
        node.getAttribute('aria-checked'),
      ),
    };
    app.dispose();

    let readOnlyChanges = 0;
    app = mount(controls.RadioGroup, {
      defaultValue: 'a',
      readOnly: true,
      onValueChange: () => {
        readOnlyChanges++;
      },
      get children() {
        return ['a', 'b'].map((value) =>
          component(controls.Radio.Root, { value, children: value }),
        );
      },
    });
    app.container.querySelectorAll('[role=radio]')[1].click();
    app.container.querySelectorAll('input')[1].click();
    flush();
    result.readOnlyRadio = {
      changes: readOnlyChanges,
      selected: app.container.querySelector('[role=radio]').getAttribute('aria-checked'),
    };
    app.dispose();

    let otp, complete;
    app = mount(controls.OTPField.Root, {
      length: 4,
      onValueChange: (value) => {
        otp = value;
      },
      onValueComplete: (value) => {
        complete = value;
      },
      get children() {
        return Array.from({ length: 4 }, () => component(controls.OTPField.Input, {}));
      },
    });
    const first = app.container.querySelector('input:not([type=hidden])');
    first.value = '1234';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    flush();
    result.otp = {
      otp,
      complete,
      slots: Array.from(app.container.querySelectorAll('input:not([type=hidden])')).map(
        (input) => input.value,
      ),
    };
    app.dispose();

    let number;
    app = mount(controls.NumberField.Root, {
      defaultValue: 2,
      min: 0,
      max: 10,
      locale: 'pt-BR',
      onValueChange: (value) => {
        number = value;
      },
      get children() {
        return component(controls.NumberField.Input, {});
      },
    });
    let input = app.container.querySelector('input');
    input.value = '3,5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flush();
    result.number = { number, text: input.value, stable: input.isConnected };
    app.dispose();

    let submitted;
    app = mount(controls.Form, {
      onFormSubmit: (values) => {
        submitted = values;
      },
      get children() {
        return component(controls.Field.Root, {
          name: 'email',
          get children() {
            return [
              component(controls.Field.Label, { children: 'Email' }),
              component(controls.Field.Control, { type: 'email', required: true }),
              component(controls.Field.Error, {}),
            ];
          },
        });
      },
    });
    const form = app.container.querySelector('form');
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    flush();
    const invalid = form.querySelector('input').getAttribute('aria-invalid');
    input = form.querySelector('input');
    input.value = 'test@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flush();
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    flush();
    result.form = { invalid, submitted };
    form.reset();
    await Promise.resolve();
    flush();
    result.fieldReset = {
      value: input.value,
      invalid: input.getAttribute('aria-invalid'),
      dirty: input.hasAttribute('data-dirty'),
      touched: input.hasAttribute('data-touched'),
    };
    app.dispose();

    app = mount(controls.Slider.Root, {
      defaultValue: [20, 40],
      step: 10,
      minStepsBetweenValues: 2,
      get children() {
        return component(controls.Slider.Control, {
          get children() {
            return [component(controls.Slider.Thumb, {}), component(controls.Slider.Thumb, {})];
          },
        });
      },
    });
    input = app.container.querySelector('input');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    flush();
    result.sliderPush = Array.from(app.container.querySelectorAll('input')).map(
      (input) => input.value,
    );
    app.dispose();

    let disabledClicks = 0;
    app = mount(controls.Button, {
      disabled: true,
      focusableWhenDisabled: true,
      nativeButton: false,
      onClick: () => {
        disabledClicks++;
      },
      render(props) {
        const span = document.createElement('span');
        spread(span, props);
        return span;
      },
    });
    app.container.querySelector('span').click();
    flush();
    result.disabledClicks = disabledClicks;
    app.dispose();

    app = mount(controls.ToggleGroup, {
      disabled: true,
      get children() {
        return component(controls.Toggle, { value: 'a', disabled: false, children: 'A' });
      },
    });
    result.disabledToggle = app.container.querySelector('button').disabled;
    app.dispose();

    app = mount(controls.Fieldset.Root, {
      disabled: true,
      get children() {
        return [
          component(controls.Fieldset.Legend, { children: 'Options' }),
          component(controls.Checkbox.Root, { disabled: false, children: 'Choice' }),
        ];
      },
    });
    const fieldset = app.container.querySelector('fieldset');
    result.fieldset = {
      disabled: app.container.querySelector('[role=checkbox]').getAttribute('aria-disabled'),
      legend: document.getElementById(fieldset.getAttribute('aria-labelledby'))?.textContent,
    };
    app.dispose();
    root.remove();
    return result;
  });
  assert.deepEqual(errors, [], 'The browser must not report errors.');
  assert.deepEqual(result.checkbox, {
    stable: true,
    focused: true,
    checked: 'true',
    data: [['flag', 'on']],
  });
  assert.equal(result.reset, false);
  assert.deepEqual(result.checkboxGroup, ['b']);
  assert.deepEqual(result.radio, { selected: 'b', states: ['false', 'true'] });
  assert.deepEqual(result.readOnlyRadio, { changes: 0, selected: 'true' });
  assert.deepEqual(result.otp, { otp: '1234', complete: '1234', slots: ['1', '2', '3', '4'] });
  assert.deepEqual(result.number, { number: 3.5, text: '3,5', stable: true });
  assert.deepEqual(result.form, { invalid: 'true', submitted: { email: 'test@example.com' } });
  assert.deepEqual(result.fieldReset, { value: '', invalid: null, dirty: false, touched: false });
  assert.deepEqual(result.sliderPush, ['30', '50']);
  assert.equal(result.disabledClicks, 0);
  assert.equal(result.disabledToggle, true);
  assert.deepEqual(result.fieldset, { disabled: 'true', legend: 'Options' });
  console.log(
    'Solid control browser checks passed: state, focus, groups, form data/reset, validation, OTP, locale numbers, slider collision, and disabled controls.',
  );
} finally {
  await browser.close();
}
