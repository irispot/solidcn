import { PNG } from 'pngjs';

/** Exact RGBA comparison. No tolerance, anti-alias exclusion, or masked region. */
export function comparePng(referenceBytes, solidBytes) {
  const reference = PNG.sync.read(referenceBytes);
  const solid = PNG.sync.read(solidBytes);
  const width = Math.max(reference.width, solid.width);
  const height = Math.max(reference.height, solid.height);
  const difference = new PNG({ width, height });
  let changedPixels = 0;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const output = (y * width + x) * 4;
      const left = (y * reference.width + x) * 4;
      const right = (y * solid.width + x) * 4;
      const outside =
        x >= reference.width || x >= solid.width || y >= reference.height || y >= solid.height;
      const changed =
        outside ||
        [0, 1, 2, 3].some(
          (channel) => reference.data[left + channel] !== solid.data[right + channel],
        );
      if (changed) {
        changedPixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        difference.data.set([235, 0, 60, 255], output);
      } else {
        const gray = Math.round(
          (reference.data[left] + reference.data[left + 1] + reference.data[left + 2]) / 3,
        );
        const faded = Math.round(225 + (gray * 30) / 255);
        difference.data.set([faded, faded, faded, 255], output);
      }
    }
  }
  return {
    passed: changedPixels === 0,
    changedPixels,
    totalPixels: width * height,
    changedPercent: (changedPixels / (width * height)) * 100,
    dimensions: {
      reference: [reference.width, reference.height],
      solid: [solid.width, solid.height],
    },
    differenceBounds: changedPixels
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
    differencePng: PNG.sync.write(difference),
  };
}
