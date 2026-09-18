/** Find remote image URLs written as literal JSX image sources. */
export function staticImageUrls(source) {
  const urls = new Set();
  for (const match of source.matchAll(/<(?:img|Image|[A-Z][\w.]*Image)\b([^>]*)>/gs)) {
    const sourceMatch = match[1].match(/\bsrc\s*=\s*(["'])(https?:\/\/[^"'<>]+)\1/);
    if (sourceMatch) urls.add(sourceMatch[2]);
  }
  return [...urls];
}

/** Decode images with a time bound so pending media cannot make a capture appear static. */
export async function prepareImages(page, urls = [], timeoutMs = 8000) {
  return page.evaluate(async ({ urls, timeoutMs }) => {
    const decode = async (image, source) => {
      let timer;
      try {
        const status = await Promise.race([
          image.decode().then(() => 'decoded', () => 'failed'),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve('timeout'), timeoutMs);
          }),
        ]);
        if (status === 'timeout') throw new Error(`Image decode timed out: ${source}`);
        return { source, status, width: image.naturalWidth, height: image.naturalHeight };
      } finally {
        clearTimeout(timer);
      }
    };
    const images = urls.length
      ? urls.map((source) => {
          const image = new Image();
          image.src = source;
          return { image, source };
        })
      : [...document.images].map((image) => ({ image, source: image.currentSrc || image.src }));
    return Promise.all(images.filter(({ source }) => source).map(({ image, source }) => decode(image, source)));
  }, { urls, timeoutMs });
}
