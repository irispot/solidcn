import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { galleryCatalogPlugin } from './tooling/visual/gallery-plugin.mjs';
export default defineConfig({
  plugins: [galleryCatalogPlugin(), solid({ hot: false }), tailwindcss()],
  optimizeDeps: { entries: ['index.html'] },
  resolve: {
    alias: [
      {
        find: /^@solid-cn\/base-ui\/(.*)$/,
        replacement: resolve('base-ui/packages/solid/src/$1/index.ts'),
      },
      { find: '@solid-cn/base-ui', replacement: resolve('base-ui/packages/solid/src/index.ts') },
      {
        find: /^@solid-cn\/ui\/(.*)$/,
        replacement: resolve('shadcn-ui/packages/solid/src/$1.tsx'),
      },
    ],
  },
  build: {
    outDir: 'artifacts/preview',
    rolldownOptions: {
      input: { preview: resolve('index.html'), gallery: resolve('tooling/visual/gallery.html') },
    },
  },
});
