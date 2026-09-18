import { afterEach } from 'vitest';
import { hydrateFixtureRoot, nativeSource } from './fixture-renderer';
import { createRenderer as createClientRenderer } from './select-client-fixture-entry';
import type { FixtureElement } from './fixture-runtime';

export * from './select-client-fixture-entry';
// This route selects the original browser-only hydration assertion. The DOM
// host is JSDOM, but the server and client graphs are both native Solid.
export const isJSDOM = false;

const serverContainers = new Set<HTMLElement>();
afterEach(() => {
  for (const container of serverContainers) container.remove();
  serverContainers.clear();
});

export function createRenderer(options?: Parameters<typeof createClientRenderer>[0]) {
  const client = createClientRenderer(options);
  return {
    ...client,
    renderToString(element: FixtureElement, options: { container?: HTMLElement } = {}) {
      const renderServer = (globalThis as any).__solidCnAccordionRootSsr;
      if (typeof renderServer !== 'function')
        throw new Error('The live Solid Accordion SSR graph is not ready.');
      const container = options.container ?? document.createElement('div');
      if (!container.isConnected) document.body.appendChild(container);
      serverContainers.add(container);
      container.innerHTML = renderServer(element, nativeSource);
      return {
        container,
        hydrate() {
          const serverNodes = [...container.querySelectorAll('[_hk]')];
          const hydrated = hydrateFixtureRoot(container, element);
          const clientNodes = [...container.querySelectorAll('[_hk]')];
          if (serverNodes.length === 0 || serverNodes.length !== clientNodes.length ||
              serverNodes.some((node, index) => node !== clientNodes[index]))
            throw new Error('Solid Accordion hydration replaced server nodes.');
          console.info('Native Solid Accordion node identity:', serverNodes.length);
          return hydrated;
        },
      };
    },
  };
}
