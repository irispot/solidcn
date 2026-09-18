/** Load the shared font metrics before components measure their initial layout.
 * Waiting only after mount lets fallback-font widths enter saved slider and
 * popup measurements. Both frameworks use the same fonts and sample text.
 */
export async function prepareExampleFonts() {
  const samples = [
    ['Geist Variable', 'Example 0123456789'],
    ['Geist Mono Variable', 'Code 0123456789'],
    ['Noto Sans Arabic Variable', 'العربية ۱۲۳۴۵'],
    ['Noto Sans Hebrew Variable', 'עברית 0123456789'],
  ];
  await Promise.all(samples.map(([family, text]) => document.fonts.load(`16px "${family}"`, text)));
  await Promise.all([...document.fonts].filter(face => face.family.includes('Vazirmatn')).map(face => face.load()));
  await document.fonts.ready;
}
