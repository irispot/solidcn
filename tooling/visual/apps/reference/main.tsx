import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Base from '../../../../base-ui/packages/react/src/index';
import * as Switch from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/switch';
import * as Button from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/button';
import * as Checkbox from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/checkbox';
import * as Input from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/input';
import * as Tabs from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/tabs';
import * as Progress from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/progress';
import * as Separator from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/separator';
import * as Menu from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/dropdown-menu';
import * as Select from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/select';
import * as Combobox from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/combobox';
import * as Dialog from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/dialog';
import * as Tooltip from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/tooltip';
import * as Direction from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/direction';
import { FormScenario, SonnerScenario } from './parity-scenarios';
import { cases, fixtureTree } from '../../fixtures.mjs';
import { cases as exampleCases } from 'virtual:visual-example-cases';
import { previewDiagnostics } from '../diagnostics';
import { prepareExampleFonts } from '../prepare-fonts';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import { visualImageConfig } from '../image-config.mjs';
import './styles.css';

const requestedCase = new URLSearchParams(location.search).get('case');
const fixture =
  [...cases, ...exampleCases].find(({ id }) => id === requestedCase) ??
  (requestedCase ? undefined : cases[0]);
const host = document.getElementById('visual-case');
const diagnostics = previewDiagnostics('react', fixture, host);
let Example;
try {
  if (!fixture) throw new Error(`Unknown requested case: ${requestedCase}`);
  if (fixture.exampleName) {
    document.body.classList.add('docs-example');
    document.body.dataset.lang = fixture.language ?? 'en';
    const module = await import('virtual:react-doc-examples');
    Example = await module.loadExample(fixture.exampleName);
    await Promise.all([import('../docs-fonts.css'), import('virtual:visual-doc-theme.css')]);
    await prepareExampleFonts();
  }
} catch (error) {
  diagnostics.report(error);
}
const Shadcn = {
  ...Switch,
  ...Button,
  ...Checkbox,
  ...Input,
  ...Tabs,
  ...Progress,
  ...Separator,
  ...Menu,
  ...Select,
  ...Combobox,
  ...Dialog,
  ...Tooltip,
  ...Direction,
  FormScenario,
  SonnerScenario,
};
const registry = fixture?.layer === 'base' ? Base : Shadcn;
function materialize(node, key = 0) {
  if (typeof node === 'string' || typeof node === 'number') return node;
  const type = /^[a-z]/.test(node.type)
    ? node.type
    : node.type.split('.').reduce((value, key) => value?.[key], registry);
  if (!type) throw new Error(`Reference component missing: ${node.type}`);
  const children = !node.children.length
    ? undefined
    : typeof node.children[0] === 'function'
      ? (item, index) => materialize(node.children[0](item, index), index)
      : node.children.map((child, index) => materialize(child, index));
  return React.createElement(type, { ...node.props, key, children });
}
function App() {
  React.useEffect(() => {
    if (diagnostics.failed) return;
    window.__visualMeta = {
      framework: 'react',
      case: fixture.id,
      sourceModules: [
        ...new Set(
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) =>
              /base-ui\/packages\/react\/src|shadcn-ui\/apps\/v4\/registry\/bases\/base\/ui|shadcn-ui\/apps\/v4\/examples\/base|tooling\/visual\/examples/.test(
                url,
              ),
            ),
        ),
      ],
      sourceExample: fixture.sourceExample,
      previewLayout: fixture.preview,
      iconSelection: 'Lucide; registry editor placeholder resolved by apps/reference/icons.tsx',
    };
    window.__visualReady = true;
  }, []);
  if (Example) {
    return React.createElement(
      Base.DirectionProvider,
      { direction: fixture.direction ?? 'ltr' },
      React.createElement(Example),
    );
  }
  return materialize(fixtureTree(fixture));
}
if (!diagnostics.failed) {
  try {
    host.style.width =
      new URLSearchParams(location.search).get('gallery') === '1'
        ? `min(100%, ${fixture.width}px)`
        : `${fixture.width}px`;
    if (fixture.exampleName) {
      // Large source previews use h-auto in their MDX. Keep the configured
      // minimum for small examples, but never center tall content above y=0.
      host.dataset.example = fixture.exampleName;
      host.style.minHeight = `max(${fixture.height}px, var(--source-preview-min-height, 0px))`;
      host.style.height = 'auto';
      const layout = document.createElement('style');
      layout.dataset.sourcePreviewLayout = fixture.preview?.source ?? 'configured-example';
      layout.textContent = (fixture.preview?.layout?.rules ?? [])
        .map((rule) => {
          const selector = `body.docs-example #visual-case${rule.target === 'children' ? ' > div' : ''}`;
          const declaration = Object.entries(rule.style)
            .map(([property, value]) => `${property}:${value}`)
            .join(';');
          const css = `${selector}{${declaration}}`;
          return rule.minWidth === undefined ? css : `@media(min-width:${rule.minWidth}px){${css}}`;
        })
        .join('\n');
      document.head.append(layout);
    } else {
      host.style.height = `${fixture.height}px`;
    }
    createRoot(host, { onUncaughtError: (error) => diagnostics.report(error, 'render') }).render(
      React.createElement(
        ImageConfigContext.Provider,
        { value: visualImageConfig },
        React.createElement(App),
      ),
    );
  } catch (error) {
    diagnostics.report(error, 'render');
  }
}
