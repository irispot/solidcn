import { resolve } from 'node:path';
import { cases as fixtures } from './fixtures.mjs';
import { getExampleCases, getExampleCatalog } from './example-catalog.mjs';
import { auditExamples } from './audit.mjs';
import { sourceProvenance, fingerprint } from './provenance.mjs';

export function galleryCatalogPlugin() {
  const id = '\0virtual:solid-cn-gallery-catalog';
  return {
    name: 'solid-cn-gallery-catalog',
    resolveId(source) {
      if (source === 'virtual:solid-cn-gallery-catalog') return id;
    },
    async load(source) {
      if (source !== id) return;
      const examples = await getExampleCases();
      const audit = await auditExamples();
      const catalog = {
        sourceFingerprint: fingerprint(await sourceProvenance()),
        cases: [...fixtures, ...examples].map(
          ({ id, kind, layer, component, state, exampleName, actions, viewport }) => ({
            id,
            kind,
            layer,
            component,
            state,
            exampleName,
            actions,
            viewport,
          }),
        ),
        examples: (await getExampleCatalog()).map(
          ({ name, component, sourceRelative, docUrl, unlisted }) => ({
            name,
            component,
            sourceRelative,
            docUrl,
            unlisted,
          }),
        ),
        audit: {
          counts: audit.counts,
          examples: audit.examples.map(({ name, status, error }) => ({ name, status, error })),
        },
      };
      return `export default ${JSON.stringify(catalog)};`;
    },
    configureServer(server) {
      const directory = resolve(import.meta.dirname, 'examples');
      const settings = resolve(import.meta.dirname, 'example-cases.json');
      const docs = resolve(
        import.meta.dirname,
        '../../shadcn-ui/apps/v4/content/docs/components/base',
      );
      const upstreamExamples = resolve(
        import.meta.dirname,
        '../../shadcn-ui/apps/v4/examples/base',
      );
      const transform = resolve(import.meta.dirname, 'docs/transform.mjs');
      const workspace = resolve(import.meta.dirname, '../..');
      const fingerprintRoots = ['tooling/visual', 'base-ui', 'shadcn-ui'].map((path) =>
        resolve(workspace, path),
      );
      const fingerprintFiles = [
        'package-lock.json',
        'tooling/generate-icons.mjs',
        'tooling/parity/upstreams.json',
      ].map((path) => resolve(workspace, path));
      server.watcher.add([...fingerprintRoots, ...fingerprintFiles]);
      const update = (path) => {
        if (
          !/\/(?:node_modules|dist)\//.test(path) &&
          (fingerprintFiles.includes(path) ||
            fingerprintRoots.some((directory) => path.startsWith(`${directory}/`)))
        ) {
          const module = server.moduleGraph.getModuleById(id);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        }
      };
      for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, update);
      server.httpServer?.once('close', () => {
        for (const event of ['add', 'change', 'unlink']) server.watcher.off(event, update);
      });
    },
  };
}
