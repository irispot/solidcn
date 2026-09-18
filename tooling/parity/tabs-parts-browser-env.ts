// The pinned assertion library reads process.env in its browser matcher.
// Vite does not provide this Node global in the test page.
Object.assign(globalThis, {
  process: { env: { NODE_ENV: 'test' } },
});
