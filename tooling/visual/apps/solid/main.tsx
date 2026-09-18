import { createEffect } from 'solid-js';
import { render, Dynamic, createComponent } from '@solidjs/web';
import * as Base from '../../../../base-ui/packages/solid/src/index';
import * as Switch from '../../../../shadcn-ui/packages/solid/src/switch';
import * as Button from '../../../../shadcn-ui/packages/solid/src/button';
import * as Checkbox from '../../../../shadcn-ui/packages/solid/src/checkbox';
import * as Input from '../../../../shadcn-ui/packages/solid/src/input';
import * as Tabs from '../../../../shadcn-ui/packages/solid/src/tabs';
import * as Progress from '../../../../shadcn-ui/packages/solid/src/progress';
import * as Separator from '../../../../shadcn-ui/packages/solid/src/separator';
import * as Menu from '../../../../shadcn-ui/packages/solid/src/dropdown-menu';
import * as Select from '../../../../shadcn-ui/packages/solid/src/select';
import * as Combobox from '../../../../shadcn-ui/packages/solid/src/combobox';
import * as Dialog from '../../../../shadcn-ui/packages/solid/src/dialog';
import * as Tooltip from '../../../../shadcn-ui/packages/solid/src/tooltip';
import * as Direction from '../../../../shadcn-ui/packages/solid/src/direction';
import { FormScenario, SonnerScenario } from './parity-scenarios';
import { cases, fixtureTree } from '../../fixtures.mjs';
import { cases as exampleCases } from 'virtual:visual-example-cases';
import { previewDiagnostics } from '../diagnostics';
import { prepareExampleFonts } from '../prepare-fonts';
import './styles.css';

const requestedCase = new URLSearchParams(location.search).get('case');
const fixture =
  [...cases, ...exampleCases].find(({ id }) => id === requestedCase) ??
  (requestedCase ? undefined : cases[0]);
const host = document.getElementById('visual-case');
const diagnostics = previewDiagnostics('solid', fixture, host);
let Example;
try {
  if (!fixture) throw new Error(`Unknown requested case: ${requestedCase}`);
  if (fixture.exampleName) {
    document.body.classList.add('docs-example');
    document.body.dataset.lang = fixture.language ?? 'en';
    const module = await import('virtual:solid-doc-examples');
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
function materialize(node) {
  if (typeof node === 'string' || typeof node === 'number') return node;
  const intrinsic = /^[a-z]/.test(node.type);
  const type = intrinsic
    ? node.type
    : node.type.split('.').reduce((value, key) => value?.[key], registry);
  if (!type) throw new Error(`Solid component missing: ${node.type}`);
  const { className, ...rest } = node.props;
  if (intrinsic && (node.type === 'svg' || node.type === 'path')) {
    for (const [name, attribute] of Object.entries({
      strokeWidth: 'stroke-width',
      strokeLinecap: 'stroke-linecap',
      strokeLinejoin: 'stroke-linejoin',
    })) {
      if (name in rest) {
        rest[attribute] = rest[name];
        delete rest[name];
      }
    }
  }
  const props = {
    ...rest,
    ...(className ? { class: className } : {}),
    get children() {
      return !node.children.length
        ? undefined
        : typeof node.children[0] === 'function'
          ? (item, index) => materialize(node.children[0](item, index))
          : node.children.map(materialize);
    },
  };
  return intrinsic
    ? createComponent(Dynamic, { component: type, ...props })
    : createComponent(type, props);
}
function App() {
  createEffect(
    () => true,
    () => {
      if (diagnostics.failed) return;
      window.__visualMeta = {
        framework: 'solid',
        case: fixture.id,
        sourceModules: [
          ...new Set(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .filter((url) =>
                /base-ui\/packages\/solid\/src|shadcn-ui\/packages\/solid\/src|solid-doc-example|tooling\/visual\/examples/.test(
                  url,
                ),
              ),
          ),
        ],
        sourceExample: fixture.sourceExample,
        previewLayout: fixture.preview,
      };
      window.__visualReady = true;
    },
  );
  if (Example) {
    return createComponent(Base.DirectionProvider, {
      direction: fixture.direction ?? 'ltr',
      get children() {
        return createComponent(Example, {});
      },
    });
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
    render(() => createComponent(App, {}), host);
  } catch (error) {
    diagnostics.report(error, 'render');
  }
}
