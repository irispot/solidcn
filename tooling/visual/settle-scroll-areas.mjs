/** Trigger native scroll measurement after image decode, then restore the original position. */
export async function settleScrollAreas(page) {
  return page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const measurements = [];
    for (const viewport of document.querySelectorAll('[data-slot="scroll-area-viewport"]')) {
      const before = { left: viewport.scrollLeft, top: viewport.scrollTop };
      let moved = false;
      if (viewport.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft = before.left + 1;
        if (viewport.scrollLeft === before.left) viewport.scrollLeft = before.left - 1;
        moved = viewport.scrollLeft !== before.left;
      }
      if (!moved && viewport.scrollHeight > viewport.clientHeight) {
        viewport.scrollTop = before.top + 1;
        if (viewport.scrollTop === before.top) viewport.scrollTop = before.top - 1;
        moved = viewport.scrollTop !== before.top;
      }
      if (moved) {
        await frame();
        viewport.scrollLeft = before.left;
        viewport.scrollTop = before.top;
        await frame();
        await frame();
      }
      if (viewport.scrollLeft !== before.left || viewport.scrollTop !== before.top)
        throw new Error('The scroll-area position changed during capture preparation.');
      measurements.push({ ...before, moved, restored: true });
    }
    return measurements;
  });
}
