import { relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const root = resolve(import.meta.dirname, '../..');

/** Record source modules that Vite actually transforms in this test process. */
export function sourceAudit(mode: 'react' | 'solid'): Plugin {
  const seen = new Set<string>();
  return {
    name: `parity-${mode}-source-audit`,
    enforce: 'pre',
    transform(_code, id) {
      const file = relative(root, id.split('?')[0]).replaceAll('\\', '/');
      if (
        seen.has(file) ||
        !/^(?:base-ui\/packages\/(?:react|solid|utils)\/src\/|tooling\/parity\/)/.test(file) ||
        !/\.[cm]?[jt]sx?$/.test(file)
      ) {
        return;
      }
      seen.add(file);
      console.log(`Parity source loaded: ${JSON.stringify({ mode, file })}`);
    },
  };
}
