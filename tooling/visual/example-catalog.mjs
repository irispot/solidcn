import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import ts from 'typescript';
import { discoverInteractionStates } from './interaction-recipes.mjs';

const root = resolve(import.meta.dirname, '../..');
const localRoot = resolve(import.meta.dirname, 'examples');
const docsRoot = resolve(root, 'shadcn-ui/apps/v4/content/docs/components/base');
const sourceRoot = resolve(root, 'shadcn-ui/apps/v4/examples/base');
const settingsPath = resolve(import.meta.dirname, 'example-cases.json');

// Read JSX opening tags with quote/bracket awareness: chart.mdx contains a
// literal `>` inside className, so a `<ComponentPreview[^>]*>` regex truncates it.
export function extractPreviewMetadata(code, source) {
  const output = [];
  for (const match of code.matchAll(/<ComponentPreview\b/g)) {
    let quote = null;
    let braces = 0;
    let end = match.index + match[0].length;
    for (; end < code.length; end++) {
      const char = code[end];
      if (quote) {
        if (char === quote && code[end - 1] !== '\\') quote = null;
      } else if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') braces++;
      else if (char === '}') braces--;
      else if (char === '>' && braces === 0) break;
    }
    const tag = code.slice(match.index, end + 1).replace(/\/?\s*>$/, '/>');
    const file = ts.createSourceFile(
      source + '.tsx',
      `const preview=${tag}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const element = file.statements[0]?.declarationList?.declarations[0]?.initializer;
    if (!element || !ts.isJsxSelfClosingElement(element)) continue;
    const values = {};
    const unsupportedAttributes = [];
    for (const attribute of element.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        unsupportedAttributes.push('spread');
        continue;
      }
      const name = attribute.name.getText(file);
      const initializer = attribute.initializer;
      const literal =
        initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
      if (!initializer) values[name] = true;
      else if (literal && ts.isStringLiteral(literal)) values[name] = literal.text;
      else if (literal?.kind === ts.SyntaxKind.TrueKeyword) values[name] = true;
      else if (literal?.kind === ts.SyntaxKind.FalseKeyword) values[name] = false;
      else unsupportedAttributes.push(name);
    }
    if (typeof values.name !== 'string') continue;
    const preview = {
      source,
      className: values.className,
      previewClassName: values.previewClassName,
      align: values.align ?? 'center',
      chromeLessOnMobile: values.chromeLessOnMobile ?? false,
      unsupportedAttributes,
    };
    preview.layout = previewLayout(preview);
    output.push({ name: values.name, ...preview });
  }
  return output;
}

function previewLayout(preview) {
  const rules = [];
  const unsupportedLayoutClasses = [];
  const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
  if (['center', 'start', 'end'].includes(preview.align)) {
    rules.push({
      target: 'preview',
      style: { 'align-items': preview.align === 'center' ? 'center' : 'flex-start' },
    });
    if (preview.align === 'end')
      rules.push({ target: 'preview', minWidth: 640, style: { 'align-items': 'flex-end' } });
  }
  if (preview.chromeLessOnMobile) rules.push({ target: 'preview', style: { padding: '0px' } });
  const entries = [
    ...(typeof preview.previewClassName === 'string'
      ? preview.previewClassName
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => ({ token, target: 'preview' }))
      : []),
    ...(typeof preview.className === 'string'
      ? preview.className.split(/\s+/).flatMap((token) => {
          const match = token.match(
            /^\[&_(?:\.preview|\[data-slot=['"]?preview['"]?\])([^\]]*)\]:(.+)$/,
          );
          if (!match) return [];
          if (match[1] !== '' && match[1] !== '>div') {
            unsupportedLayoutClasses.push(token);
            return [];
          }
          return [{ token: match[2], target: match[1] ? 'children' : 'preview' }];
        })
      : []),
  ];
  for (const entry of entries) {
    let token = entry.token;
    let minWidth;
    const responsive = token.match(/^(sm|md|lg|xl|2xl|min-\[\d+px\]):(.+)$/);
    if (responsive) {
      minWidth = breakpoints[responsive[1]] ?? Number(responsive[1].match(/\d+/)[0]);
      token = responsive[2];
    }
    const important = token.endsWith('!');
    if (important) token = token.slice(0, -1);
    const style = {};
    const padding = token.match(/^(p|px|py|pt|pb|pl|pr)-(\d+(?:\.\d+)?)$/);
    if (padding) {
      const value = `${Number(padding[2]) * 4}px`;
      const properties = {
        p: ['padding'],
        px: ['padding-left', 'padding-right'],
        py: ['padding-top', 'padding-bottom'],
        pt: ['padding-top'],
        pb: ['padding-bottom'],
        pl: ['padding-left'],
        pr: ['padding-right'],
      }[padding[1]];
      for (const property of properties) style[property] = value;
    } else if (token === 'h-auto') style.height = 'auto';
    else if (token === 'w-full') style.width = '100%';
    else if (token === 'border-none') style.border = 'none';
    else if (token === 'shadow-none') style['box-shadow'] = 'none';
    else if (/^(?:min-)?h-\[\d+(?:\.\d+)?(?:px|rem)\]$/.test(token))
      style['--source-preview-min-height'] = token.match(/\[([^\]]+)\]/)[1];
    else if (/^(?:min-)?h-\d+$/.test(token))
      style['--source-preview-min-height'] = `${Number(token.match(/\d+$/)[0]) * 4}px`;
    else if (/^items-(?:start|end|center|stretch|baseline)$/.test(token)) {
      const value = token.slice('items-'.length);
      style['align-items'] = value === 'start' || value === 'end' ? `flex-${value}` : value;
    } else if (
      /^(?:h-|w-|min-h-|max-h-|p[xytrbl]?-|items-|justify-)/.test(token) ||
      entry.target === 'children'
    )
      unsupportedLayoutClasses.push(entry.token);
    if (important) for (const property in style) style[property] += ' !important';
    if (Object.keys(style).length) rules.push({ ...entry, token: undefined, minWidth, style });
  }
  rules.sort((left, right) => (left.minWidth ?? -1) - (right.minWidth ?? -1));
  return {
    scope:
      'Literal preview spacing/alignment, minimum height, and direct-div width/border/shadow; documentation chrome and color-theme classes are not included.',
    rules,
    unsupportedLayoutClasses,
  };
}

async function previewMetadata(documentation) {
  const previews = new Map(
    documentation.flatMap((page) =>
      (page.previews ?? []).map((preview) => [preview.name, preview]),
    ),
  );
  // Helpers share the same ComponentPreview contract but are not component
  // catalog pages. Read their metadata without adding/removing catalog entries.
  const helpers = resolve(root, 'shadcn-ui/apps/v4/content/docs/helpers');
  for (const name of (await readdir(helpers)).filter((name) => name.endsWith('.mdx'))) {
    const path = resolve(helpers, name);
    for (const preview of extractPreviewMetadata(
      await readFile(path, 'utf8'),
      relative(root, path),
    ))
      if (!previews.has(preview.name)) previews.set(preview.name, preview);
  }
  return previews;
}
async function json(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}
async function exportName(source, configured) {
  if (configured) return configured;
  const code = await readFile(source, 'utf8');
  const file = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (
    file.statements.some(
      (node) =>
        ts.isExportAssignment(node) ||
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword),
    )
  )
    return 'default';
  const named = file.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) &&
        node.name &&
        /^[A-Z]/.test(node.name.text),
    )
    .map((node) => node.name.text);
  if (named.length === 1) return named[0];
  throw new Error(
    `${relative(root, source)} needs one default component export or an explicit exportName in its case JSON.`,
  );
}
function states(config) {
  const value = config.states ?? [
    {
      name: 'default',
      actions: config.actions ?? [],
      popups: config.popups ?? [],
    },
  ];
  if (!Array.isArray(value) || !value.length)
    throw new Error('An example must have at least one state.');
  for (const state of value)
    if (!/^[a-z0-9-]+$/.test(state.name))
      throw new Error(`Invalid example state name: ${state.name}`);
  return value;
}
async function exampleStates(source, config) {
  const configured = states(config);
  if (config.discoverInteractions === false) return configured;
  try {
    return [
      ...configured,
      ...discoverInteractionStates(await readFile(source, 'utf8'), source, configured),
    ];
  } catch (error) {
    if (error.code === 'ENOENT') return configured;
    throw error;
  }
}
export async function discoverDocumentation() {
  const pages = [];
  for (const file of (await readdir(docsRoot)).filter((name) => name.endsWith('.mdx')).sort()) {
    const path = resolve(docsRoot, file);
    const code = await readFile(path, 'utf8');
    const previews = extractPreviewMetadata(code, relative(root, path));
    pages.push({
      page: basename(file, '.mdx'),
      docPath: relative(root, path),
      docUrl: `https://ui.shadcn.com/docs/components/base/${basename(file, '.mdx')}`,
      examples: [...new Set(previews.map((preview) => preview.name))],
      previews,
    });
  }
  return pages;
}
export async function getExampleCatalog({
  pages = (process.env.SOLID_CN_DOC_PAGES ?? '*') === '*'
    ? '*'
    : process.env.SOLID_CN_DOC_PAGES.split(',').filter(Boolean),
  includeLocal = true,
} = {}) {
  const configured = await json(settingsPath, {});
  const documentation = await discoverDocumentation();
  const previewByName = await previewMetadata(documentation);
  const chosen =
    pages === '*' ? documentation : documentation.filter((item) => pages.includes(item.page));
  if (pages !== '*')
    for (const page of pages)
      if (!chosen.some((item) => item.page === page))
        throw new Error(`Unknown documentation page: ${page}`);
  const entries = [];
  const owners = new Map();
  for (const page of chosen)
    for (const name of page.examples) {
      const score = name.startsWith(`${page.page}-`) ? page.page.length : 0;
      if (!owners.has(name) || score > owners.get(name).score) owners.set(name, { page, score });
    }
  // The documentation does not link every committed example. Keep these visible
  // too, including examples whose dependencies or native components are missing.
  if (pages === '*')
    for (const file of await readdir(sourceRoot)) {
      if (!file.endsWith('.tsx')) continue;
      const name = basename(file, '.tsx');
      if (owners.has(name)) continue;
      const page = [...documentation]
        .sort((a, b) => b.page.length - a.page.length)
        .find((item) => name.startsWith(`${item.page}-`));
      owners.set(name, {
        page: page
          ? { ...page, unlisted: true }
          : {
              page: name.replace(/-(?:demo|basic|rtl)$/, ''),
              docUrl: null,
              docPath: null,
              unlisted: true,
            },
        score: 0,
      });
    }
  for (const [name, { page }] of [...owners].sort(([a], [b]) => a.localeCompare(b))) {
    const source = resolve(sourceRoot, `${name}.tsx`);
    let discoveryError;
    let componentExport;
    try {
      await access(source);
      componentExport = await exportName(source, configured[name]?.exportName);
    } catch (error) {
      discoveryError = error.message;
    }
    const config = configured[name] ?? {};
    entries.push({
      name: `docs/${name}`,
      source,
      sourceRelative: relative(root, source),
      exportName: componentExport,
      discoveryError,
      unlisted: !!page.unlisted,
      component: page.page,
      docUrl: page.docUrl,
      docPath: page.docPath,
      preview: page.previews?.find((preview) => preview.name === name) ?? previewByName.get(name),
      direction: config.direction ?? (name.endsWith('-rtl') ? 'rtl' : 'ltr'),
      language: config.language ?? (name.endsWith('-rtl') ? 'ar' : 'en'),
      width: config.width ?? 760,
      height: config.height ?? 360,
      states: await exampleStates(source, config),
    });
  }
  if (includeLocal) {
    async function walk(directory) {
      let files;
      try {
        files = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
        const source = resolve(directory, file.name);
        if (file.isDirectory()) {
          await walk(source);
          continue;
        }
        if (!file.name.endsWith('.tsx')) continue;
        const config = await json(source.replace(/\.tsx$/, '.json'), {});
        const name = relative(localRoot, source).replace(/\.tsx$/, '');
        let componentExport;
        let discoveryError;
        try {
          componentExport = await exportName(source, config.exportName);
        } catch (error) {
          discoveryError = error.message;
        }
        entries.push({
          name: `local/${name}`,
          source,
          sourceRelative: relative(root, source),
          exportName: componentExport,
          discoveryError,
          component: config.component ?? name.split('/').at(-1),
          docUrl: config.docUrl ?? null,
          local: true,
          direction: config.direction ?? 'ltr',
          language: config.language ?? 'en',
          width: config.width ?? 760,
          height: config.height ?? 360,
          states: await exampleStates(source, config),
        });
      }
    }
    await walk(localRoot);
  }
  return entries;
}
export async function getExampleCases(options) {
  const entries = await getExampleCatalog(options);
  const cases = entries.flatMap((entry) =>
    entry.states.map((state) => ({
      id: `${entry.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${state.name}`,
      kind: 'example',
      exampleName: entry.name,
      sourceExample: entry.sourceRelative,
      exportName: entry.exportName,
      discoveryError:
        entry.discoveryError ??
        (!entry.exportName ? 'The example needs an explicit component export.' : undefined),
      unlisted: entry.unlisted,
      docUrl: entry.docUrl,
      layer: 'shadcn',
      component: entry.component,
      state: state.name,
      recipe: state.recipe,
      actions: state.actions ?? [],
      popups: state.popups ?? [],
      popupOverflow: state.popupOverflow,
      viewport: state.viewport,
      width: state.width ?? entry.width,
      height: state.height ?? entry.height,
      direction: entry.direction,
      language: entry.language,
      preview: entry.preview,
    })),
  );
  if (new Set(cases.map((item) => item.id)).size !== cases.length)
    throw new Error('Example case IDs collide. Rename one copied example.');
  return cases;
}
