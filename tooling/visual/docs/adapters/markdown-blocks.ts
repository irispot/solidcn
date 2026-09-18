// Block splitting follows Streamdown 2.5.0, Copyright 2023 Vercel, Inc.
// Licensed under Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0
// Only its framework-independent parsing algorithm is reproduced here.
import { Lexer } from 'marked';

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
function openingTags(text: string, tag: string) {
  if (voidTags.has(tag.toLowerCase())) return 0;
  return [...text.matchAll(new RegExp(`<${tag}(?=[\\s>/])[^>]*>`, 'gi'))].filter(
    ([match]) => !match.trimEnd().endsWith('/>'),
  ).length;
}
function closingTags(text: string, tag: string) {
  return [...text.matchAll(new RegExp(`</${tag}(?=[\\s>])[^>]*>`, 'gi'))].length;
}
export function markdownBlocks(text: string): string[] {
  if (/\[\^[\w-]{1,200}\](?!:)/.test(text) || /\[\^[\w-]{1,200}\]:/.test(text)) return [text];
  const blocks: string[] = [];
  const open: string[] = [];
  let previousWasCode = false;
  for (const token of Lexer.lex(text, { gfm: true })) {
    const raw = token.raw;
    if (open.length) {
      blocks[blocks.length - 1] += raw;
      const tag = open.at(-1)!;
      const starts = openingTags(raw, tag);
      const ends = closingTags(raw, tag);
      for (let index = 0; index < starts; index++) open.push(tag);
      for (let index = 0; index < ends; index++) if (open.at(-1) === tag) open.pop();
      continue;
    }
    if (token.type === 'html' && token.block) {
      const tag = raw.match(/<(\w+)[\s>]/)?.[1];
      if (tag && openingTags(raw, tag) > closingTags(raw, tag)) open.push(tag);
    }
    if (blocks.length && !previousWasCode) {
      const previous = blocks.at(-1)!;
      if ([...previous.matchAll(/\$\$/g)].length % 2) {
        blocks[blocks.length - 1] += raw;
        continue;
      }
    }
    blocks.push(raw);
    if (token.type !== 'space') previousWasCode = token.type === 'code';
  }
  return blocks;
}
