/** Ask Chromium to paint the final CSS state again without changing that state. */
export async function refreshPaint(page) {
  return page.evaluate(async () => {
    const style = document.querySelector('style[data-vite-dev-id$="/styles.css"]');
    if (!(style instanceof HTMLStyleElement) || style.parentNode !== document.head)
      throw new Error('The visual app stylesheet is missing.');

    const next = style.nextSibling;
    const nodes = [...document.head.childNodes];
    const css = style.textContent;
    const attributes = style.outerHTML.slice(0, style.outerHTML.indexOf('>') + 1);
    document.head.removeChild(style);
    document.head.insertBefore(style, next);

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (
      style.textContent !== css ||
      style.outerHTML.slice(0, style.outerHTML.indexOf('>') + 1) !== attributes ||
      nodes.length !== document.head.childNodes.length ||
      nodes.some((node, index) => node !== document.head.childNodes[index])
    )
      throw new Error('Paint refresh changed the final stylesheet or document order.');

    return { style: style.getAttribute('data-vite-dev-id'), unchanged: true };
  });
}
