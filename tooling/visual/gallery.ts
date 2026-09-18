// The root Vite plugin supplies the current, read-only discovery catalog.
// @ts-expect-error This virtual module is supplied by Vite.
import data from 'virtual:solid-cn-gallery-catalog';
import upstreams from '../parity/upstreams.json';

type Action = { type: string; selector: string; value?: string; state?: string };
type Case = {
  id: string;
  kind?: string;
  layer: string;
  component: string;
  state?: string;
  exampleName?: string;
  sourceExample?: string;
  docUrl?: string;
  actions?: Action[];
  width?: number;
  height?: number;
  viewport?: { width: number; height: number };
};
type ConversionStatus = 'ready-for-browser' | 'needs-transform' | 'needs-source';
type SourceExample = {
  name: string;
  component: string;
  sourceRelative: string;
  docUrl?: string;
  unlisted?: boolean;
};
type Entry = {
  id: string;
  name: string;
  component: string;
  kind: 'docs' | 'local' | 'fixture';
  layer: string;
  cases: Case[];
  source: string;
  docUrl?: string;
  status: ConversionStatus;
  error?: string;
  unlisted?: boolean;
};
type View = 'solid' | 'react' | 'both';
const catalog = data as {
  sourceFingerprint: string;
  cases: Case[];
  examples: SourceExample[];
  audit: {
    counts: Record<ConversionStatus, number>;
    examples: { name: string; status: ConversionStatus; error?: string }[];
  };
};
const query = new URLSearchParams(location.search);
const entries: Entry[] = [];
const audit = new Map(catalog.audit.examples.map((entry) => [entry.name, entry]));
const byExample = new Map<string, Case[]>();
for (const fixture of catalog.cases) {
  if (fixture.exampleName) {
    const states = byExample.get(fixture.exampleName) ?? [];
    states.push(fixture);
    byExample.set(fixture.exampleName, states);
  }
}
// Use the source inventory, not the pages that happen to link to each file.
// Failed conversions stay in the catalog and retain both preview links.
for (const example of catalog.examples) {
  const check = audit.get(example.name);
  entries.push({
    id: example.name,
    name: example.name.slice(example.name.indexOf('/') + 1),
    component: example.component,
    kind: example.name.startsWith('local/') ? 'local' : 'docs',
    layer: 'shadcn',
    cases: byExample.get(example.name) ?? [],
    source: example.sourceRelative,
    docUrl: example.docUrl,
    unlisted: example.unlisted,
    status: check?.status ?? 'needs-source',
    error: check?.error,
  });
}
for (const fixture of catalog.cases.filter((item) => !item.exampleName)) {
  entries.push({
    id: fixture.id,
    name: `${fixture.layer === 'base' ? 'Base UI' : 'shadcn/ui'} · ${fixture.state ?? 'default'}`,
    component: fixture.component,
    kind: 'fixture',
    layer: fixture.layer,
    cases: [fixture],
    source: 'tooling/visual/fixtures.mjs',
    status: 'ready-for-browser',
    docUrl:
      fixture.layer === 'base'
        ? `https://base-ui.com/react/components/${fixture.component}`
        : `https://ui.shadcn.com/docs/components/base/${fixture.component === 'menu' ? 'dropdown-menu' : fixture.component}`,
  });
}
entries.sort((left, right) => {
  return left.component.localeCompare(right.component) || left.name.localeCompare(right.name);
});
function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing gallery element: ${id}`);
  return value as T;
}
const search = element<HTMLInputElement>('search');
const filter = element<HTMLSelectElement>('status-filter');
const caseSelect = element<HTMLSelectElement>('case-select');
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
const count = (value: number) => value.toLocaleString('en-US');
const title = (value: string) =>
  value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
let selected =
  entries.find((entry) => entry.id === query.get('example')) ??
  entries.find((entry) => entry.cases.some((fixture) => fixture.id === query.get('case'))) ??
  entries.find((entry) => entry.name === 'button-group-demo') ??
  entries.find((entry) => entry.cases.length) ??
  entries[0];
let selectedCase = selected?.cases.find((fixture) => fixture.id === query.get('case'));
let view: View = ['solid', 'react', 'both'].includes(query.get('view') ?? '')
  ? (query.get('view') as View)
  : 'solid';
let currentFrameCase = '';
type PixelResult = { id: string; passed: boolean; changedPixels?: number; error?: string };
let pixelReport:
  | {
      checkedAt: string;
      sourceFingerprint: string;
      valid: boolean;
      passedCases: number;
      totalCases: number;
      results: PixelResult[];
    }
  | undefined;
search.value = query.get('q') ?? '';
if ([...filter.options].some((option) => option.value === query.get('filter')))
  filter.value = query.get('filter')!;

function text(tag: string, content: string, className?: string) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}
function updateURL() {
  const params = new URLSearchParams();
  if (selected) params.set('example', selected.id);
  if (selectedCase) params.set('case', selectedCase.id);
  if (view !== 'solid') params.set('view', view);
  if (search.value.trim()) params.set('q', search.value.trim());
  if (filter.value !== 'all') params.set('filter', filter.value);
  history.replaceState(null, '', `${location.pathname}?${params}`);
}
function matches(entry: Entry) {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack =
    `${entry.component} ${entry.name} ${entry.kind} ${entry.layer} ${entry.cases.map((item) => item.id).join(' ')}`.toLowerCase();
  if (!terms.every((term) => haystack.includes(term))) return false;
  if (filter.value === 'runnable') return entry.status === 'ready-for-browser';
  if (filter.value === 'unconnected') return entry.status !== 'ready-for-browser';
  if (filter.value === 'unlisted') return !!entry.unlisted;
  if (filter.value === 'fixtures') return entry.kind === 'fixture';
  if (filter.value === 'docs' || filter.value === 'local') return entry.kind === filter.value;
  return true;
}
function renderList() {
  const focusedEntry = (document.activeElement as HTMLElement)?.dataset.entry;
  const fragment = document.createDocumentFragment();
  const visible = entries.filter(matches);
  let currentGroup = '';
  let group: HTMLElement | undefined;
  for (const entry of visible) {
    if (currentGroup !== entry.component) {
      currentGroup = entry.component;
      group = document.createElement('section');
      group.className = 'component-group';
      group.append(text('h3', title(entry.component)));
      fragment.append(group);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'example-item';
    button.dataset.entry = entry.id;
    const ready = entry.status === 'ready-for-browser';
    button.title = `${entry.name} — ${ready ? 'Conversion ready; pixels not verified' : 'Needs conversion'}`;
    if (selected?.id === entry.id) button.setAttribute('aria-current', 'true');
    const dot = text('span', '', `status-dot ${ready ? 'ready' : 'pending'}`);
    dot.setAttribute('aria-hidden', 'true');
    const name = text('span', entry.name, 'item-name');
    const status = text('span', ready ? 'Conversion ready' : 'Needs conversion', 'sr-only');
    button.append(dot, name, status);
    if (entry.kind !== 'docs')
      button.append(text('span', entry.kind === 'local' ? 'Local' : 'Check', 'item-tag'));
    else if (entry.unlisted) button.append(text('span', 'Unlisted', 'item-tag'));
    button.addEventListener('click', () => selectEntry(entry));
    group!.append(button);
  }
  if (!visible.length) {
    const empty = text('div', 'No examples match this search.', 'list-empty');
    const clear = text('button', 'Clear search and filters', 'text-button') as HTMLButtonElement;
    clear.type = 'button';
    clear.addEventListener('click', () => {
      search.value = '';
      filter.value = 'all';
      renderList();
      updateURL();
      search.focus();
    });
    empty.append(clear);
    fragment.append(empty);
  }
  element('example-list').replaceChildren(fragment);
  if (focusedEntry)
    element('example-list')
      .querySelector<HTMLButtonElement>(`[data-entry="${CSS.escape(focusedEntry)}"]`)
      ?.focus({ preventScroll: true });
  element('result-count').textContent = `${count(visible.length)} shown`;
}
function externalLink(label: string, href: string) {
  const link = text('a', `${label} ↗`, 'source-link') as HTMLAnchorElement;
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function sourceURL(source: string) {
  if (source.startsWith('shadcn-ui/'))
    return `https://github.com/shadcn-ui/ui/blob/${upstreams['shadcn-ui'].commit}/${source.slice('shadcn-ui/'.length)}`;
  if (source.startsWith('base-ui/'))
    return `https://github.com/mui/base-ui/blob/${upstreams['base-ui'].commit}/${source.slice('base-ui/'.length)}`;
  return new URL(`/${source}?raw`, location.origin).href;
}
function previewURL(framework: 'react' | 'solid', fixture: Case) {
  const url = new URL(location.origin);
  url.port = framework === 'react' ? '5181' : '5182';
  url.pathname = '/';
  url.search = new URLSearchParams({ case: fixture.id, gallery: '1' }).toString();
  return url.href;
}
function describeAction(action: Action) {
  if (action.type === 'wait')
    return `Wait for ${action.selector} to be ${action.state ?? 'visible'}.`;
  if (action.type === 'fill') return `Enter “${action.value}” in ${action.selector}.`;
  if (action.type === 'press') return `Press ${action.value} on ${action.selector}.`;
  if (action.type === 'hover') return `Move the pointer onto ${action.selector}.`;
  if (action.type === 'right-click') return `Right-click ${action.selector}.`;
  if (action.type === 'open') return `Click ${action.selector} if it is not already open.`;
  if (action.type === 'focus') return `Put keyboard focus on ${action.selector}.`;
  return `Click ${action.selector}.`;
}
function renderCase() {
  if (!selectedCase) return;
  renderPixelStatus();
  const actions = selectedCase.actions ?? [];
  const note = element('interaction-note');
  note.replaceChildren(
    text('strong', actions.length ? 'Manual interaction' : 'Live preview'),
    text(
      'span',
      actions.length
        ? 'Open menus, click controls, or use the keyboard in each view. Case actions are not run automatically.'
        : 'Use the controls in each view. Changes in one view do not change the other view.',
    ),
  );
  if (currentFrameCase !== selectedCase.id) {
    currentFrameCase = selectedCase.id;
    for (const framework of ['solid', 'react'] as const) {
      const url = previewURL(framework, selectedCase);
      const frame = element<HTMLIFrameElement>(`${framework}-frame`);
      frame.style.width = selectedCase.viewport ? `${selectedCase.viewport.width}px` : '';
      frame.style.height = selectedCase.viewport ? `${selectedCase.viewport.height}px` : '';
      frame.src = url;
      frame.title = `${framework === 'solid' ? 'Native Solid' : 'Original React'} — ${selected.name} — ${selectedCase.state ?? 'default'}`;
      element<HTMLAnchorElement>(`${framework}-open`).href = url;
    }
  }
  const info = element('case-information');
  info.replaceChildren(text('p', selectedCase.id, 'case-id'));
  info.append(
    text(
      'p',
      'Both previews use the same source example or check definition. Open a preview in a new tab if you need more space.',
    ),
  );
  if (actions.length) {
    const steps = document.createElement('ol');
    for (const action of actions) steps.append(text('li', describeAction(action)));
    info.append(steps);
  } else info.append(text('p', 'This case has no configured action steps.'));
  info.append(
    text(
      'p',
      'If a preview is blank, check that the local preview servers on ports 5181 and 5182 are running.',
    ),
  );
}
function renderPixelStatus() {
  const status = element('pixel-status');
  status.replaceChildren(text('span', 'Pixel check: no current result.'));
  if (!pixelReport) return;
  const current = pixelReport.valid && pixelReport.sourceFingerprint === catalog.sourceFingerprint;
  const result = pixelReport.results.find((entry) => entry.id === selectedCase?.id);
  const date = new Date(pixelReport.checkedAt).toLocaleString();
  const message = !current
    ? `The last pixel run is out of date or invalid (${date}).`
    : !result
      ? 'This case has not been checked in the current full run.'
      : result.error
        ? `Pixel check failed: ${result.error}`
        : result.passed
          ? `Exact pixel match for this case (${date}).`
          : `${count(result.changedPixels ?? 0)} pixels differ in this case (${date}).`;
  status.replaceChildren(
    text('span', message),
    externalLink('Pixel report', '/artifacts/visual/report.html'),
  );
}
async function loadPixelStatus() {
  try {
    const response = await fetch('/artifacts/visual/status.json', { cache: 'no-store' });
    if (!response.ok) return;
    pixelReport = await response.json();
    renderPixelStatus();
  } catch {
    /* The first full run has not produced a status file yet. */
  }
}
function renderView() {
  const both = view === 'both';
  element('preview-panels').classList.toggle('split-view', both);
  element('preview-panels').setAttribute('aria-labelledby', `tab-${view}`);
  element('solid-panel').hidden = view === 'react';
  element('react-panel').hidden = view === 'solid';
  for (const tab of tabs) {
    const active = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
}
function selectEntry(entry: Entry) {
  selected = entry;
  selectedCase = entry.cases.find((fixture) => fixture.state === 'default') ?? entry.cases[0];
  renderSelection();
  renderList();
  updateURL();
}
function renderSelection() {
  if (!selected) return;
  const ready = selected.status === 'ready-for-browser';
  element('example-category').textContent =
    `${title(selected.component)} / ${selected.kind === 'fixture' ? `${selected.layer === 'base' ? 'Base UI' : 'shadcn/ui'} check` : selected.kind === 'local' ? 'Local example' : 'Documentation example'}`;
  element('example-title').textContent =
    selected.kind === 'fixture'
      ? `${title(selected.component)} · ${selected.cases[0].state}`
      : selected.name;
  element('example-description').textContent =
    selected.kind === 'docs'
      ? 'The original shadcn/ui documentation example, from the cloned source.'
      : selected.kind === 'local'
        ? 'One local TSX file. The preview converts this file for the native Solid view.'
        : 'A small check definition shared by the original and native component views.';
  document.title = `${selected.name} · Solid CN gallery`;
  const sourceLinks = element('source-links');
  sourceLinks.replaceChildren(
    externalLink(
      selected.kind === 'docs' ? 'Original source' : 'Local source',
      sourceURL(selected.source),
    ),
  );
  if (selected.docUrl) sourceLinks.append(externalLink('Documentation', selected.docUrl));
  const status = element('example-status');
  status.replaceChildren(
    text(
      'span',
      ready ? 'Conversion ready' : 'Needs conversion',
      `status-badge ${ready ? 'ready' : 'pending'}`,
    ),
  );
  status.append(
    text(
      'span',
      ready
        ? `${selected.cases.length} configured ${selected.cases.length === 1 ? 'case' : 'cases'} · Pixel parity not verified by this status`
        : 'Both previews are available below. An unsupported example shows its own error.',
    ),
  );
  const error = element('conversion-error');
  error.hidden = !selected.error;
  error.textContent = selected.error ?? '';
  element('connected-view').hidden = false;
  caseSelect.replaceChildren();
  for (const fixture of selected.cases) {
    const option = document.createElement('option');
    option.value = fixture.id;
    option.textContent = `${title(fixture.state ?? 'default')}${fixture.actions?.length ? ' · manual steps' : ''}`;
    option.selected = fixture.id === selectedCase?.id;
    caseSelect.append(option);
  }
  renderCase();
  renderView();
}

const docCount = entries.filter((entry) => entry.kind === 'docs').length;
const counts = element('catalog-counts');
for (const [number, label] of [
  [docCount, 'upstream files'],
  [entries.filter((entry) => entry.status !== 'ready-for-browser').length, 'need conversion'],
  [catalog.cases.length, 'cases'],
] as const) {
  const box = document.createElement('div');
  box.append(text('strong', count(number)), text('span', label));
  counts.append(box);
}
search.addEventListener('input', () => {
  renderList();
  updateURL();
});
filter.addEventListener('change', () => {
  renderList();
  updateURL();
});
caseSelect.addEventListener('change', () => {
  selectedCase = selected.cases.find((fixture) => fixture.id === caseSelect.value);
  renderCase();
  updateURL();
});
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    view = tab.dataset.view as View;
    renderView();
    updateURL();
  });
  tab.addEventListener('keydown', (event) => {
    let next: number | undefined;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  });
});
element('reload').addEventListener('click', () => {
  currentFrameCase = '';
  renderCase();
  void loadPixelStatus();
});
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (
    event.key === '/' &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
    !target.isContentEditable &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === 'Escape' && target === search) {
    search.value = '';
    renderList();
    updateURL();
  }
});
renderList();
if (!selectedCase)
  selectedCase =
    selected?.cases.find((fixture) => fixture.state === 'default') ?? selected?.cases[0];
renderSelection();
updateURL();
void loadPixelStatus();
