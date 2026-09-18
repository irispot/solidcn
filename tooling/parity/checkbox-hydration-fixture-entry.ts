import { nativeSource, hydrateFixtureRoot } from './fixture-renderer';
import { createRenderer as createClientRenderer } from './select-client-fixture-entry';
import type { FixtureElement } from './fixture-runtime';
import { afterEach } from 'vitest';

export * from './select-client-fixture-entry';
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
      const renderServer = (globalThis as any).__solidCnCheckboxSsr;
      if (typeof renderServer !== 'function')
        throw new Error('The live Solid Checkbox SSR graph is not ready.');
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
            throw new Error('Solid Checkbox hydration replaced server nodes.');
          console.info('Native Solid Checkbox node identity:', serverNodes.length);
          return hydrated;
        },
      };
    },
  };
}
