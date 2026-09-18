/**
 * Vite 8.3 still injects its client and starts its transport when server.ws=false.
 * Keep its real CSS module helpers, but do not start that disabled development
 * transport. This does not intercept HTTP, component imports, console errors,
 * window errors, or rejected promises. Selected failures use diagnostics.ts.
 */
export function isolatedPreviewPlugin() {
  return {
    name: 'solid-cn-isolated-preview-transport',
    enforce: 'pre',
    configResolved(config) {
      if (config.server.hmr !== false || config.server.ws !== false)
        throw new Error('Isolated previews require server.hmr=false and server.ws=false.');
    },
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/vite/dist/client/client.mjs')) return;
      const calls = [
        'transport.connect(createHMRHandler(handleMessage));',
        'setupForwardConsoleHandler(transport, forwardConsole);',
      ];
      for (const call of calls) {
        if (code.split(call).length !== 2)
          throw new Error(`Vite client changed. Review the isolated transport adapter: ${call}`);
        code = code.replace(
          call,
          '// Development transport is disabled for isolated visual cases.',
        );
      }
      return { code, map: null };
    },
  };
}
