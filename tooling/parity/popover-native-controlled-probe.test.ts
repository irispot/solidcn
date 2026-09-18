import { createSignal, flush } from 'solid-js';
import { createComponent, render } from '@solidjs/web';
import { expect, it } from 'vitest';
import { Popover } from '../../base-ui/packages/solid/src/overlays';

it('opens a controlled nested native Popover when its Solid signal changes', () => {
  globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  const [childOpen, setChildOpen] = createSignal(false);
  const host = document.createElement('div');
  const opener = document.createElement('button');
  opener.textContent = 'Open child';
  opener.addEventListener('click', () => setChildOpen(true));
  document.body.append(host);
  const dispose = render(
    () => createComponent(Popover.Root, {
      defaultOpen: true,
      get children() {
        return createComponent(Popover.Portal, {
          get children() {
            return createComponent(Popover.Positioner, {
              get children() {
                return createComponent(Popover.Popup, {
                  get children() {
                    return [opener, createComponent(Popover.Root, {
                      get open() { return childOpen(); },
                      onOpenChange: setChildOpen,
                      triggerId: 'child-reference',
                      get children() {
                        return [
                          createComponent(Popover.Trigger, {
                            id: 'child-reference',
                            children: 'Child reference',
                          }),
                          createComponent(Popover.Portal, {
                            get children() {
                              return createComponent(Popover.Positioner, {
                                get children() {
                                  return createComponent(Popover.Popup, {
                                    'data-testid': 'child-popup',
                                    get children() {
                                      return createComponent(Popover.Close, {
                                        children: 'Close child',
                                      });
                                    },
                                  });
                                },
                              });
                            },
                          }),
                        ];
                      },
                    })];
                  },
                });
              },
            });
          },
        });
      },
    }),
    host,
  );
  flush();
  expect(document.querySelector('[data-testid="child-popup"]')).toBe(null);
  opener.focus();
  opener.click();
  flush();
  expect(document.querySelector('[data-testid="child-popup"]')).not.toBe(null);
  const childClose = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Close child');
  expect(childClose).toBeDefined();
  childClose!.click();
  flush();
  expect(document.querySelector('[data-testid="child-popup"]')).toBe(null);
  expect(document.activeElement).toBe(opener);
  dispose();
  host.remove();
});
