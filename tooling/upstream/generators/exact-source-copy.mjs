// A framework-neutral upstream module can be replayed without a transform.
export function generate({ inputs }) {
  if (inputs.length !== 1) throw new Error('Exact source copy requires one pinned input.');
  return inputs[0].code;
}
