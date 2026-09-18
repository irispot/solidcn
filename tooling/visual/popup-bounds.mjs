export function captureViewport(value = { width: 900, height: 700 }) {
  if (!value || Object.keys(value).some((key) => !['width', 'height'].includes(key)) ||
    ![value.width, value.height].every((size) => Number.isInteger(size) && size >= 100 && size <= 4096))
    throw new Error('A capture viewport needs integer width and height from 100 to 4096.');
  return value;
}

/** Check actual popup visibility. An explicit source contract can require an
 * edge to extend outside the viewport (a compact Drawer snap point). This does
 * not crop or mask the screenshot: every viewport pixel is still compared.
 */
export function checkPopupBounds(selector, bounds, viewport, expected) {
  captureViewport(viewport);
  if (!bounds || !Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0)
    throw new Error(`Expected popup has no positive visible bounds: ${selector}`);
  const edges = [
    ['left', bounds.x < 0],
    ['top', bounds.y < 0],
    ['right', bounds.x + bounds.width > viewport.width],
    ['bottom', bounds.y + bounds.height > viewport.height],
  ].filter(([, outside]) => outside).map(([edge]) => edge);
  const requested = expected?.edges ?? [];
  if (expected && (!expected.reason?.trim() || !Array.isArray(requested) || !requested.length ||
    new Set(requested).size !== requested.length || requested.some((edge) => !['left', 'top', 'right', 'bottom'].includes(edge))))
    throw new Error(`Popup overflow needs explicit edges and a source reason: ${selector}`);
  if (edges.length !== requested.length || edges.some((edge) => !requested.includes(edge)))
    throw new Error(`Unexpected popup viewport overflow: ${selector}: ${JSON.stringify({ bounds, edges, expected: requested })}`);
  const visible = {
    x: Math.max(0, bounds.x),
    y: Math.max(0, bounds.y),
    right: Math.min(viewport.width, bounds.x + bounds.width),
    bottom: Math.min(viewport.height, bounds.y + bounds.height),
  };
  if (visible.right <= visible.x || visible.bottom <= visible.y)
    throw new Error(`Expected popup is outside the captured viewport: ${selector}`);
  return { selector, ...bounds, visible, overflowEdges: edges, sourceReason: expected?.reason };
}
