import { format } from 'prettier';
import { readFile } from 'node:fs/promises';

/** Copy source CSS through the recorded formatter; no native snapshot is read. */
export async function generate({ inputs }) {
  if (inputs.length !== 1 || !inputs[0].path.endsWith('.css'))
    throw new Error('The style generator needs one CSS input.');
  const options = JSON.parse(await readFile(new URL('./format.json', import.meta.url), 'utf8'));
  return format(inputs[0].code, { ...options, parser: 'css' });
}
