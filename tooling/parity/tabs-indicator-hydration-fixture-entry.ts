import { afterEach } from 'vitest';
import { hydrateFixtureRoot, nativeSource } from './fixture-renderer';
import { createRenderer as createClientRenderer } from './select-client-fixture-entry';
import type { FixtureElement } from './fixture-runtime';

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
      const renderServer = (globalThis as any).__solidCnTabsIndicatorSsr;
      if (typeof renderServer !== 'function')
        throw new Error('The live Solid Tabs Indicator SSR graph is not ready.');
      const container = options.container ?? document.createElement('div');
      if (!container.isConnected) document.body.appendChild(container);
      serverContainers.add(container);
      container.innerHTML = renderServer(element, nativeSource);
      return {
        container,
        async hydrate() {
          const serverNodes = [...container.querySelectorAll('[_hk]')]
            .filter((node) => node.localName !== 'script');
          const hydrated = hydrateFixtureRoot(container, element);
          // Solid completes the mount transition in a microtask after it claims SSR nodes.
          await Promise.resolve();
          const clientNodes = [...container.querySelectorAll('[_hk]')]
            .filter((node) => node.localName !== 'script');
          if (serverNodes.length === 0 || serverNodes.length !== clientNodes.length ||
              serverNodes.some((node, index) => node !== clientNodes[index]))
            throw new Error('Solid Tabs Indicator hydration replaced server nodes.');
          if (container.querySelector('script'))
            throw new Error('Solid Tabs Indicator hydration kept the pre-hydration script.');
          console.info('Native Solid Tabs Indicator node identity:', serverNodes.length);
          return hydrated;
        },
      };
    },
  };
}
