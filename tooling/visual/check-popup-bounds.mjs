import assert from 'node:assert/strict';
import { captureViewport, checkPopupBounds } from './popup-bounds.mjs';

const viewport = captureViewport();
const partial = { x: 0, y: 217, width: 900, height: 591 };
const contract = { edges: ['bottom'], reason: 'The source Drawer opens at its compact snap point.' };
assert.deepEqual(captureViewport({ width: 390, height: 844 }), { width: 390, height: 844 });
for (const invalid of [{ width: 0, height: 700 }, { width: 900.5, height: 700 }, { width: 900, height: 700, scale: 0.5 }])
  assert.throws(() => captureViewport(invalid));
assert.deepEqual(checkPopupBounds('popup', { x: 2, y: 3, width: 10, height: 20 }, viewport).overflowEdges, []);
assert.throws(() => checkPopupBounds('popup', partial, viewport));
assert.throws(() => checkPopupBounds('popup', partial, viewport, { edges: ['bottom'] }));
assert.throws(() => checkPopupBounds('popup', partial, viewport, { ...contract, edges: ['left'] }));
assert.throws(() => checkPopupBounds('popup', { ...partial, x: -1 }, viewport, contract));
assert.throws(() => checkPopupBounds('popup', { ...partial, y: 800 }, viewport, contract));
assert.throws(() => checkPopupBounds('popup', { ...partial, height: 10 }, viewport, contract));
const accepted = checkPopupBounds('popup', partial, viewport, contract);
assert.deepEqual(accepted.visible, { x: 0, y: 217, right: 900, bottom: 700 });
assert.equal(accepted.height, 591, 'Keep the complete element bounds as evidence.');
console.log('Popup bounds checks passed: full visibility, explicit source overflow, wrong edges, offscreen content, and viewport validation.');
