import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { captureStable } from './capture-stable.mjs';
const png = value => {
  const image = new PNG({ width: 2, height: 2 });
  image.data.fill(255);
  image.data[0] = value;
  return PNG.sync.write(image);
};
const images = [png(0), png(1)];
const page = values => ({ evaluate: async () => {}, screenshot: async () => images[values.shift()] });
assert.deepEqual((await captureStable(page([0, 0, 0]))).changes, [0, 0]);
const settled = await captureStable(page([0, 1, 1, 1]));
assert.deepEqual(settled.changes, [1, 0, 0]);
assert.deepEqual(settled.png, images[1]);
await assert.rejects(() => captureStable(page([0, 1, 0, 1, 0, 1])), /did not reach/);
await assert.rejects(() => captureStable(page([0, 0, 1, 1, 0, 0])), /did not reach/);
console.log('Strict capture checks passed: three identical images, recorded warm-up changes, one-channel rejection, persistent-change rejection.');
