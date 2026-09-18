// Native renderer for the original docs Markdown helper.
// Default DOM/classes follow Streamdown 2.5.0, Copyright 2023 Vercel, Inc.
// Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0
// Parsing, sanitization, incomplete text repair, and highlighting use the same
// framework-independent libraries as Streamdown. No React runtime is loaded.
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Dynamic, Portal, type JSX } from '@solidjs/web';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { harden } from 'rehype-harden';
import remend from 'remend';
import { visit } from 'unist-util-visit';
import {
  code as defaultCode,
  type CodeHighlighterPlugin,
  type HighlightResult,
} from '@streamdown/code';
import { cn } from '../../../../shadcn-ui/packages/solid/src/utils';
import { markdownBlocks } from './markdown-blocks';
import { MarkdownIcon } from './markdown-icons';

type Node = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, any>;
  children?: Node[];
};
type Props = {
  children?: string;
  className?: string;
  mode?: 'streaming' | 'static';
  parseIncompleteMarkdown?: boolean;
  remend?: Parameters<typeof remend>[1];
  plugins?: { code?: CodeHighlighterPlugin; [key: string]: unknown };
  controls?: false;
  lineNumbers?: boolean;
  linkSafety?: { enabled?: boolean; onLinkCheck?: (url: string) => boolean | Promise<boolean> };
  components?: Record<string, (props: any) => JSX.Element>;
  remarkPlugins?: any[];
  rehypePlugins?: any[];
  dir?: 'ltr' | 'rtl';
  [key: string]: unknown;
};
const classes: Record<string, [string, string]> = {
  ol: ['list-inside list-decimal whitespace-normal [li_&]:pl-6', 'ordered-list'],
  ul: ['list-inside list-disc whitespace-normal [li_&]:pl-6', 'unordered-list'],
  li: ['py-1 [&>p]:inline', 'list-item'],
  hr: ['my-6 border-border', 'horizontal-rule'],
  strong: ['font-semibold', 'strong'],
  h1: ['mt-6 mb-2 font-semibold text-3xl', 'heading-1'],
  h2: ['mt-6 mb-2 font-semibold text-2xl', 'heading-2'],
  h3: ['mt-6 mb-2 font-semibold text-xl', 'heading-3'],
  h4: ['mt-6 mb-2 font-semibold text-lg', 'heading-4'],
  h5: ['mt-6 mb-2 font-semibold text-base', 'heading-5'],
  h6: ['mt-6 mb-2 font-semibold text-sm', 'heading-6'],
  thead: ['bg-muted/80', 'table-header'],
  tbody: ['divide-y divide-border', 'table-body'],
  tr: ['border-border', 'table-row'],
  th: ['whitespace-nowrap px-4 py-2 text-left font-semibold text-sm', 'table-header-cell'],
  td: ['px-4 py-2 text-sm', 'table-cell'],
  blockquote: [
    'my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic',
    'blockquote',
  ],
  sup: ['text-sm', 'superscript'],
  sub: ['text-sm', 'subscript'],
};
const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'tel'],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'metastring'],
  },
};
const codeMeta = () => (tree: any) =>
  visit(tree, 'code', (node: any) => {
    if (node.meta) {
      node.data ??= {};
      node.data.hProperties = { ...node.data.hProperties, metastring: node.meta };
    }
  });
const textOf = (node: Node): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('');
function domProps(properties: Record<string, any> = {}) {
  const result: Record<string, any> = {};
  for (const [name, value] of Object.entries(properties)) {
    if (name === 'className') continue;
    const key =
      name === 'htmlFor'
        ? 'for'
        : name
            .replace(/^aria([A-Z])/, (_, letter) => `aria-${letter.toLowerCase()}`)
            .replace(/^data([A-Z])/, (_, letter) => `data-${letter.toLowerCase()}`);
    result[key] = Array.isArray(value) ? value.join(' ') : value;
  }
  return result;
}
function nativeClass(node: Node) {
  return Array.isArray(node.properties?.className)
    ? node.properties.className.join(' ')
    : node.properties?.className;
}

function CodeBlock(props: { node: Node; options: Props }) {
  const value = () => textOf(props.node).replace(/\n+$/, '');
  const language = () => nativeClass(props.node)?.match(/language-([^\s]+)/)?.[1] ?? '';
  const raw = (): HighlightResult =>
    ({
      bg: 'transparent',
      fg: 'inherit',
      tokens: value()
        .split('\n')
        .map((content) => [
          { content, color: 'inherit', bgColor: 'transparent', htmlStyle: {}, offset: 0 },
        ]),
    }) as HighlightResult;
  const [highlight, setHighlight] = createSignal<HighlightResult | undefined>();
  createEffect(
    () => ({
      text: value(),
      language: language(),
      plugin: props.options.plugins === undefined ? defaultCode : props.options.plugins.code,
    }),
    ({ text, language, plugin }) => {
      let active = true;
      setHighlight(undefined);
      if (plugin) {
        const result = plugin.highlight(
          { code: text, language: language as any, themes: plugin.getThemes() },
          (result) => {
            if (active) setHighlight(result);
          },
        );
        if (result) setHighlight(result);
      }
      return () => {
        active = false;
      };
    },
  );
  const result = () => highlight() ?? raw();
  const numbered = () =>
    props.options.lineNumbers !== false &&
    !/\bnoLineNumbers\b/.test(props.node.properties?.metastring ?? '');
  const startLine = () =>
    Number(props.node.properties?.metastring?.match(/startLine=(\d+)/)?.[1] ?? 1);
  const preStyle = () => {
    const output: Record<string, string> = {};
    if (result().bg) output['--sdm-bg'] = result().bg!;
    if (result().fg) output['--sdm-fg'] = result().fg!;
    for (const entry of (result().rootStyle || '').split(';')) {
      const colon = entry.indexOf(':');
      if (colon > 0) output[entry.slice(0, colon).trim()] = entry.slice(colon + 1).trim();
    }
    return output;
  };
  return (
    <div
      class="my-4 flex w-full flex-col gap-2 rounded-xl border border-border bg-sidebar p-2"
      data-language={language()}
      data-streamdown="code-block"
      style={{ 'content-visibility': 'auto', 'contain-intrinsic-size': 'auto 200px' }}
    >
      <div
        class="flex h-8 items-center text-muted-foreground text-xs"
        data-language={language()}
        data-streamdown="code-block-header"
      >
        <span class="ml-1 font-mono lowercase">{language()}</span>
      </div>
      <div
        class={cn(
          nativeClass(props.node),
          'overflow-x-auto rounded-md border border-border bg-background p-4 text-sm',
        )}
        data-language={language()}
        data-streamdown="code-block-body"
      >
        <pre
          class={cn(
            nativeClass(props.node),
            'bg-[var(--sdm-bg,inherit]',
            'dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit)]',
          )}
          style={preStyle()}
        >
          <code
            class={numbered() ? '[counter-increment:line_0] [counter-reset:line]' : undefined}
            style={
              numbered() && startLine() > 1
                ? { 'counter-reset': `line ${startLine() - 1}` }
                : undefined
            }
          >
            {result().tokens.map((line) => (
              <span
                class={
                  numbered()
                    ? 'block before:content-[counter(line)] before:inline-block before:[counter-increment:line] before:w-6 before:mr-4 before:text-[13px] before:text-right before:text-muted-foreground/50 before:font-mono before:select-none'
                    : undefined
                }
              >
                {line.length === 0 || (line.length === 1 && line[0].content === '')
                  ? '\n'
                  : line.map((token) => {
                      const style: Record<string, string> = {};
                      if (token.color) style['--sdm-c'] = token.color;
                      if (token.bgColor) style['--sdm-tbg'] = token.bgColor;
                      for (const [name, value] of Object.entries(token.htmlStyle ?? {}))
                        style[
                          name === 'color'
                            ? '--sdm-c'
                            : name === 'background-color'
                              ? '--sdm-tbg'
                              : name
                        ] = String(value);
                      return (
                        <span
                          class={cn(
                            'text-[var(--sdm-c,inherit)] dark:text-[var(--shiki-dark,var(--sdm-c,inherit))]',
                            style['--sdm-tbg'] &&
                              'bg-[var(--sdm-tbg)] dark:bg-[var(--shiki-dark-bg,var(--sdm-tbg))]',
                          )}
                          style={style}
                          {...token.htmlAttrs}
                        >
                          {token.content}
                        </span>
                      );
                    })}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function SafeLink(props: { node: Node; options: Props; children: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));
  const url = () => props.node.properties?.href ?? '';
  const incomplete = () => url() === 'streamdown:incomplete-link';
  const close = () => setOpen(false);
  createEffect(open, (visible) => {
    if (!visible) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', escape);
    };
  });
  const openLink = () => window.open(url(), '_blank', 'noreferrer');
  return props.options.linkSafety?.enabled === false || !url() ? (
    <a
      class={cn('wrap-anywhere font-medium text-primary underline', nativeClass(props.node))}
      data-incomplete={String(incomplete())}
      data-streamdown="link"
      href={url()}
      rel="noreferrer"
      target="_blank"
    >
      {props.children}
    </a>
  ) : (
    <>
      <button
        class={cn(
          'wrap-anywhere appearance-none text-left font-medium text-primary underline',
          nativeClass(props.node),
        )}
        data-incomplete={String(incomplete())}
        data-streamdown="link"
        type="button"
        onClick={async () => {
          if (incomplete()) return;
          if (await props.options.linkSafety?.onLinkCheck?.(url())) openLink();
          else setOpen(true);
        }}
      >
        {props.children}
      </button>
      {open() && (
        <Portal>
          <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm"
            data-streamdown="link-safety-modal"
            onClick={close}
            role="button"
            tabindex={0}
          >
            <div
              class="relative mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border bg-background p-6 shadow-lg"
              onClick={(event) => event.stopPropagation()}
              role="presentation"
            >
              <button
                class="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                type="button"
                title="Close"
                onClick={close}
              >
                <MarkdownIcon name="close" size={16} />
              </button>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 font-semibold text-lg">
                  <MarkdownIcon name="external" size={20} />
                  <span>Open external link?</span>
                </div>
                <p class="text-muted-foreground text-sm">
                  You're about to visit an external website.
                </p>
              </div>
              <div
                class={cn(
                  'break-all rounded-md bg-muted p-3 font-mono text-sm',
                  url().length > 100 && 'max-h-32 overflow-y-auto',
                )}
              >
                {url()}
              </div>
              <div class="flex gap-2">
                <button
                  class="flex flex-1 items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 font-medium text-sm transition-all hover:bg-muted"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url());
                      setCopied(true);
                      clearTimeout(copiedTimer);
                      copiedTimer = setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* Same failure behavior as the original link dialog. */
                    }
                  }}
                >
                  <MarkdownIcon name={copied() ? 'check' : 'copy'} size={14} />
                  <span>{copied() ? 'Copied' : 'Copy link'}</span>
                </button>
                <button
                  class="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-all hover:bg-primary/90"
                  type="button"
                  onClick={() => {
                    openLink();
                    close();
                  }}
                >
                  <MarkdownIcon name="external" size={14} />
                  <span>Open link</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

function renderNode(node: Node, options: Props): JSX.Element {
  if (node.type === 'text') return node.value;
  if (node.type === 'root') return node.children?.map((child) => renderNode(child, options));
  if (node.type !== 'element') return undefined;
  const tag = node.tagName!;
  const children = () => node.children?.map((child) => renderNode(child, options));
  const custom =
    options.components?.[tag === 'code' ? 'inlineCode' : tag] ?? options.components?.[tag];
  if (custom)
    return (
      <Dynamic component={custom} {...domProps(node.properties)} node={node}>
        {children()}
      </Dynamic>
    );
  if (tag === 'pre' && node.children?.[0]?.tagName === 'code')
    return <CodeBlock node={node.children[0]} options={options} />;
  if (tag === 'a')
    return (
      <SafeLink node={node} options={options}>
        {children()}
      </SafeLink>
    );
  if (tag === 'table')
    return (
      <div
        class="my-4 flex flex-col gap-2 rounded-lg border border-border bg-sidebar p-2"
        data-streamdown="table-wrapper"
      >
        <div class="border-collapse overflow-x-auto overflow-y-auto rounded-md border border-border bg-background">
          <table
            class={cn('w-full divide-y divide-border', nativeClass(node))}
            data-streamdown="table"
            {...domProps(node.properties)}
          >
            {children()}
          </table>
        </div>
      </div>
    );
  if (tag === 'code')
    return (
      <code
        class={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm', nativeClass(node))}
        data-streamdown="inline-code"
        {...domProps(node.properties)}
      >
        {children()}
      </code>
    );
  const config = classes[tag];
  return (
    <Dynamic
      component={tag === 'strong' ? 'span' : (tag as any)}
      class={cn(config?.[0], nativeClass(node)) || undefined}
      data-streamdown={config?.[1]}
      {...domProps(node.properties)}
    >
      {children()}
    </Dynamic>
  );
}

export function Markdown(props: Props) {
  // These are not used by the cloned Markdown examples. Fail explicitly until
  // their UI/lifecycle contract has a native implementation.
  if (props.controls) throw new Error('Native Markdown controls are not implemented.');
  for (const name of [
    'animated',
    'BlockComponent',
    'caret',
    'allowedTags',
    'literalTagContent',
    'prefix',
    'icons',
    'translations',
  ])
    if (props[name]) throw new Error(`Native Markdown does not yet implement ${name}.`);
  if (Object.keys(props.plugins ?? {}).some((key) => key !== 'code'))
    throw new Error('Native Markdown currently supports only the real Shiki code plugin.');
  const processor = createMemo(() =>
    unified()
      .use(remarkParse)
      .use(props.remarkPlugins ?? [remarkGfm, codeMeta])
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(
        props.rehypePlugins ?? [
          rehypeRaw,
          [rehypeSanitize, schema],
          [
            harden,
            {
              allowedImagePrefixes: ['*'],
              allowedLinkPrefixes: ['*'],
              allowedProtocols: ['*'],
              allowDataImages: true,
            },
          ],
        ],
      ),
  );
  const content = createMemo(() => {
    const text = typeof props.children === 'string' ? props.children : '';
    const normalized =
      props.mode !== 'static' && props.parseIncompleteMarkdown !== false
        ? remend(text, props.remend)
        : text;
    return (props.mode === 'static' ? [normalized] : markdownBlocks(normalized)).map(
      (block) => processor().runSync(processor().parse(block)) as Node,
    );
  });
  return (
    <div
      class={cn(
        'space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        'cn-markdown w-full min-w-0 overflow-hidden',
        props.className,
      )}
    >
      {content().map((node) =>
        props.dir ? (
          <div dir={props.dir} style={{ display: 'contents' }}>
            {renderNode(node, props)}
          </div>
        ) : (
          renderNode(node, props)
        ),
      )}
    </div>
  );
}
