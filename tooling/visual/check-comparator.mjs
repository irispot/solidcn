import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { comparePng } from './compare.mjs';

const image = new PNG({ width: 3, height: 2 });
image.data.fill(255);
const reference = PNG.sync.write(image);
assert.equal(comparePng(reference, reference).changedPixels, 0);
image.data[(1 * 3 + 2) * 4] = 254;
const oneChannel = comparePng(reference, PNG.sync.write(image));
assert.equal(oneChannel.changedPixels, 1);
assert.deepEqual(oneChannel.differenceBounds, { x: 2, y: 1, width: 1, height: 1 });
image.data[(1 * 3 + 2) * 4] = 255;
image.data[3] = 254;
assert.equal(comparePng(reference, PNG.sync.write(image)).changedPixels, 1);
const smaller = new PNG({ width: 2, height: 2 });
smaller.data.fill(255);
assert.equal(comparePng(reference, PNG.sync.write(smaller)).changedPixels, 2);
console.log(
  'Exact image comparator checks passed: equality, one-channel delta, alpha delta, dimensions.',
);
