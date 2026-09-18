export function previewDiagnostics(framework: string, fixture: any, host: HTMLElement) {
  window.__visualReady = false;
  window.__visualError = null;
  let failed = false;
  const report = (error: unknown, phase = 'load') => {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    window.__visualReady = false;
    window.__visualError = message;
    window.__visualMeta = {
      framework,
      case: fixture?.id ?? new URLSearchParams(location.search).get('case'),
      sourceExample: fixture?.sourceExample,
      sourceModules: performance.getEntriesByType('resource').map((entry) => entry.name),
      phase,
      error: message,
    };
    const panel = document.createElement('section');
    panel.setAttribute('role', 'alert');
    panel.setAttribute('data-visual-error', '');
    panel.style.cssText =
      'font:13px/1.6 system-ui,sans-serif;color:#583b29;background:#fffaf4;border:1px solid #e8cbaa;border-radius:10px;padding:24px;width:100%;box-sizing:border-box;';
    const heading = document.createElement('h1');
    heading.style.cssText = 'font-size:19px;line-height:1.3;margin:0 0 12px;';
    heading.textContent = `${framework === 'solid' ? 'Solid' : 'Original React'} preview cannot run`;
    const description = document.createElement('p');
    description.textContent =
      'This example is in the catalog. Its selected preview failed. No substitute component is shown.';
    const source = document.createElement('p');
    source.textContent = fixture?.sourceExample ?? fixture?.id ?? 'Unknown requested case';
    source.style.cssText = 'font:11px/1.6 monospace;overflow-wrap:anywhere;';
    const detail = document.createElement('pre');
    detail.textContent = message;
    detail.style.cssText =
      'white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;padding:14px;background:#f7ede0;border-radius:5px;';
    panel.append(heading, description, source, detail);
    host.style.cssText =
      'display:block;width:min(100%,760px);height:auto;padding:24px;box-sizing:border-box;';
    host.replaceChildren(panel);
  };
  window.addEventListener('error', (event) => report(event.error ?? event.message, 'runtime'));
  window.addEventListener('unhandledrejection', (event) => report(event.reason, 'runtime'));
  return {
    report,
    get failed() {
      return failed;
    },
  };
}
