import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Native Solid browser diagnostics. This script does not change upstream tests.
// Start `npm run dev` before use. This is not an upstream parity result.
const browser = await chromium.launch({ headless: true });
const completed = [];
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.SOLID_CN_PREVIEW_URL ?? 'http://127.0.0.1:5173', {
    waitUntil: 'networkidle',
  });
  await page.evaluate(async () => {
    const source = await (await fetch('/examples/main.tsx')).text();
    const webPath = source.match(/from "([^\"]*\/@solidjs_web\.js[^\"]*)"/)[1];
    const { render, createComponent: c } = await import(webPath);
    const modules = Object.fromEntries(
      await Promise.all(
        [
          'calendar',
          'command',
          'input-otp',
          'resizable',
          'questionnaire',
          'form',
          'carousel',
          'message-scroller',
          'chart',
          'sonner',
        ].map(async (name) => [name, await import(`/shadcn-ui/packages/solid/src/${name}.tsx`)]),
      ),
    );
    const probes = (window.shadcnProbes = {});
    function mount(id, component, props) {
      const section = document.createElement('section');
      section.id = `probe-${id}`;
      section.style.cssText = 'position:relative;margin:40px;padding:20px;max-width:640px';
      document.body.append(section);
      render(() => c(component, props), section);
    }
    const calendar = modules.calendar;
    mount('calendar', calendar.Calendar, {
      mode: 'single',
      defaultMonth: new Date(2026, 8, 1),
      today: new Date(2026, 8, 17),
      onSelect: (value) => {
        probes.date = value?.getDate();
      },
    });
    const command = modules.command;
    mount('command', command.Command, {
      get children() {
        return [
          c(command.CommandInput, { placeholder: 'Find fruit' }),
          c(command.CommandList, {
            get children() {
              return ['Apple', 'Banana', 'Pear'].map((label) =>
                c(command.CommandItem, {
                  value: label,
                  children: label,
                  onSelect: (value) => {
                    probes.command = value;
                  },
                }),
              );
            },
          }),
        ];
      },
    });
    const otp = modules['input-otp'];
    mount('otp', otp.InputOTP, {
      maxLength: 4,
      'aria-label': 'Access code',
      onComplete: (value) => {
        probes.otp = value;
      },
      get children() {
        return c(otp.InputOTPGroup, {
          get children() {
            return [0, 1, 2, 3].map((index) => c(otp.InputOTPSlot, { index }));
          },
        });
      },
    });
    const resizable = modules.resizable;
    mount('resizable', resizable.ResizablePanelGroup, {
      orientation: 'horizontal',
      style: { width: '400px', height: '80px' },
      get children() {
        return [
          c(resizable.ResizablePanel, { defaultSize: 50, children: 'Left' }),
          c(resizable.ResizableHandle, {}),
          c(resizable.ResizablePanel, { defaultSize: 50, children: 'Right' }),
        ];
      },
    });
    const question = modules.questionnaire;
    mount('questionnaire', question.Questionnaire, {
      onSubmit: (event) => {
        event.preventDefault();
        probes.questionnaire = Object.fromEntries(new FormData(event.currentTarget));
      },
      get children() {
        return [
          c(question.QuestionnaireProgress, {}),
          ...['first', 'second'].map((name) =>
            c(question.QuestionnaireItem, {
              name,
              required: true,
              get children() {
                return [
                  c(question.QuestionnaireTitle, { children: name }),
                  c(question.QuestionnaireInput, { 'aria-label': name }),
                  c(question.QuestionnaireError, { children: 'Required answer' }),
                ];
              },
            }),
          ),
          c(question.QuestionnaireNext, {}),
          c(question.QuestionnaireSubmit, {}),
        ];
      },
    });
    const form = modules.form;
    function FormProbe() {
      probes.form = form.createForm({
        defaultValues: { email: '' },
        validate: (values) => (values.email ? {} : { email: 'Email required' }),
      });
      return c(form.Form, {
        control: probes.form,
        get children() {
          return c(form.FormField, {
            name: 'email',
            render() {
              return c(form.FormItem, {
                get children() {
                  return c(form.FormMessage, {});
                },
              });
            },
          });
        },
      });
    }
    mount('form', FormProbe, {});
    const carousel = modules.carousel;
    mount('carousel', carousel.Carousel, {
      setApi: (api) => {
        probes.carousel = api;
      },
      get children() {
        return [
          c(carousel.CarouselContent, {
            get children() {
              return [1, 2, 3].map((index) =>
                c(carousel.CarouselItem, { children: `Slide ${index}`, style: { height: '80px' } }),
              );
            },
          }),
          c(carousel.CarouselPrevious, {}),
          c(carousel.CarouselNext, {}),
        ];
      },
    });
    const scroller = modules['message-scroller'];
    function ScrollProbe() {
      probes.scroller = scroller.useMessageScroller();
      return c(scroller.MessageScroller, {
        style: { height: '160px', width: '400px' },
        get children() {
          return [
            c(scroller.MessageScrollerViewport, {
              get children() {
                return c(scroller.MessageScrollerContent, {
                  get children() {
                    return Array.from({ length: 12 }, (_, index) =>
                      c(scroller.MessageScrollerItem, {
                        messageId: String(index),
                        style: { height: '40px' },
                        children: `Message ${index}`,
                      }),
                    );
                  },
                });
              },
            }),
            c(scroller.MessageScrollerButton, {}),
          ];
        },
      });
    }
    mount('scroller', scroller.MessageScrollerProvider, {
      defaultScrollPosition: 'start',
      get children() {
        return c(ScrollProbe, {});
      },
    });
    const chart = modules.chart;
    mount('chart', chart.ChartContainer, {
      config: { views: { label: 'Views', color: '#0099ff' } },
      style: { width: '400px', height: '240px' },
      get children() {
        return c(chart.LineChart, {
          data: [
            { name: 'A', views: 10 },
            { name: 'B', views: 20 },
          ],
          get children() {
            return [
              c(chart.Line, { dataKey: 'views' }),
              c(chart.ChartTooltip, {
                get content() {
                  return c(chart.ChartTooltipContent, { hideLabel: true });
                },
              }),
            ];
          },
        });
      },
    });
    const sonner = modules.sonner;
    mount('sonner', sonner.Toaster, {});
    probes.notify = () =>
      sonner.toast.success('Solid notification', {
        description: 'Native toast close probe',
        duration: 0,
      });
  });
  async function check(name, action) {
    await action();
    completed.push(name);
    console.log(`PASS ${name}`);
  }
  await check('calendar date selection', async () => {
    await page.locator('#probe-calendar [data-date="2026-09-17"]').click();
    assert.equal(await page.evaluate(() => window.shadcnProbes.date), 17);
  });
  await check('command filtering and keyboard selection', async () => {
    const input = page.locator('#probe-command input');
    await input.fill('Ban');
    await input.press('ArrowDown');
    await input.press('Enter');
    assert.equal(await page.evaluate(() => window.shadcnProbes.command), 'Banana');
  });
  await check('OTP completion and visible slots', async () => {
    await page.locator('#probe-otp input').fill('1234');
    assert.equal(await page.evaluate(() => window.shadcnProbes.otp), '1234');
    assert.deepEqual(
      await page.locator('#probe-otp [data-slot=input-otp-slot]').allTextContents(),
      ['1', '2', '3', '4'],
    );
  });
  await check('resizable panel keyboard control', async () => {
    await page.locator('#probe-resizable [role=separator]').press('ArrowRight');
    assert.equal(
      await page
        .locator('#probe-resizable [data-slot=resizable-panel]')
        .first()
        .evaluate((node) => node.style.flexGrow),
      '51',
    );
  });
  await check('questionnaire required input and submit', async () => {
    const section = page.locator('#probe-questionnaire');
    await section.getByRole('button', { name: 'Next', exact: true }).click();
    await section.getByText('Required answer').first().waitFor({ state: 'visible' });
    await section.getByRole('textbox', { name: 'first', exact: true }).fill('Ada');
    await section.getByRole('button', { name: 'Next', exact: true }).click();
    await section.getByRole('textbox', { name: 'second', exact: true }).fill('Lovelace');
    await section.getByRole('button', { name: 'Submit', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.shadcnProbes.questionnaire), {
      first: 'Ada',
      second: 'Lovelace',
    });
  });
  await check('native form validation and values', async () => {
    assert.equal(await page.evaluate(() => window.shadcnProbes.form.trigger()), false);
    await page.locator('#probe-form').getByText('Email required').waitFor();
    assert.equal(
      await page.evaluate(async () => {
        const form = window.shadcnProbes.form;
        form.setValue('email', 'ada@example.com');
        return form.trigger();
      }),
      true,
    );
    assert.deepEqual(await page.evaluate(() => window.shadcnProbes.form.values), {
      email: 'ada@example.com',
    });
  });
  await check('carousel native Embla navigation', async () => {
    await page.locator('#probe-carousel').getByRole('button', { name: 'Next slide' }).click();
    assert.equal(await page.evaluate(() => window.shadcnProbes.carousel.selectedScrollSnap()), 1);
  });
  await check('message scroller end navigation', async () => {
    await page.evaluate(() => window.shadcnProbes.scroller.scrollToStart());
    const viewport = page.locator('#probe-scroller [data-slot=message-scroller-viewport]');
    assert.equal(await viewport.evaluate((node) => node.scrollTop), 0);
    await page.locator('#probe-scroller').getByRole('button', { name: 'Scroll to end' }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('#probe-scroller [data-slot=message-scroller-viewport]').scrollTop >
        0,
    );
  });
  await check('native SVG chart and custom tooltip', async () => {
    const svg = page.locator('#probe-chart svg');
    assert.ok(await svg.locator('path').first().getAttribute('d'));
    await svg.hover({ position: { x: 380, y: 100 } });
    await page.locator('#probe-chart').getByText('Views', { exact: true }).waitFor();
    assert.equal(await page.locator('#probe-chart .cn-chart-tooltip').innerText(), 'Views\n20');
  });
  await check('native toast layout and close', async () => {
    await page.evaluate(() => window.shadcnProbes.notify());
    const toast = page
      .locator('[data-slot=toast]')
      .filter({ hasText: 'Solid notification' })
      .first();
    await toast.waitFor();
    assert.ok((await toast.evaluate((node) => node.getBoundingClientRect().height)) > 0);
    assert.equal(await toast.getAttribute('toast'), null);
    await toast.getByRole('button', { name: 'Close toast' }).click();
    await toast.waitFor({ state: 'detached' });
  });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(
    `Passed ${completed.length} native Shadcn diagnostics. These are not upstream parity checks.`,
  );
} finally {
  await browser.close();
}
