import { getExampleCases } from '../example-catalog.mjs';
import { readFile } from 'node:fs/promises';

export function visualExampleCasesPlugin() {
  const id = '\0virtual:visual-example-cases';
  const themeId = '\0virtual:visual-doc-theme.css';
  return {
    name: 'visual-example-cases',
    resolveId(source) {
      if (source === 'virtual:visual-example-cases') return id;
      if (source === 'virtual:visual-doc-theme.css') return themeId;
    },
    async load(source) {
      if (source === id) return `export const cases = ${JSON.stringify(await getExampleCases())};`;
      if (source === themeId) {
        const css = await readFile(
          new URL('../../../shadcn-ui/apps/v4/app/globals.css', import.meta.url),
          'utf8',
        );
        const root = css.match(/^:root\s*\{([^}]+)\}/m);
        if (!root) throw new Error('Original documentation theme :root was not found.');
        return `body.docs-example {${root[1]}}`;
      }
    },
    configureServer(server) {
      server.watcher.add(new URL('../examples/', import.meta.url).pathname);
      const update = (path) => {
        if (path.includes('/tooling/visual/examples/')) {
          const module = server.moduleGraph.getModuleById(id);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('add', update);
      server.watcher.on('change', update);
      server.watcher.on('unlink', update);
    },
  };
}
