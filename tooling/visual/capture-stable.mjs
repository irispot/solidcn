import { comparePng } from './compare.mjs';

// Stabilize each renderer independently. Never select an image by similarity
// to the other renderer. Chromium can repaint SVG edges after its first capture.
export async function captureStable(page, maximumCaptures = 6) {
  let previous;
  let identical = 1;
  const changes = [];
  for (let attempt = 0; attempt < maximumCaptures; attempt++) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await page.screenshot({ animations: 'allow', caret: 'hide', scale: 'css', fullPage: false });
    if (previous) {
      const comparison = comparePng(previous, png);
      changes.push(comparison.changedPixels);
      identical = comparison.passed ? identical + 1 : 1;
      if (identical === 3) return { png, changes, consecutiveIdenticalCaptures: identical };
    }
    previous = png;
  }
  throw new Error(`Capture did not reach three identical images in ${maximumCaptures} attempts: ${JSON.stringify(changes)} changed pixels.`);
}
