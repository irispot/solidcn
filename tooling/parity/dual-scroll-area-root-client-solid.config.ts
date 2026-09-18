import { resolve } from 'node:path';
import type { Alias } from 'vite';
import { mergeConfig } from 'vitest/config';
import nativeConfig from './dual-checkbox-client-solid.config.ts';

const file = 'base-ui/packages/react/src/scroll-area/root/ScrollAreaRoot.test.tsx';
const config = mergeConfig(nativeConfig, {
  test: { name: 'unchanged-scroll-area-root-native-solid-client', include: [file] },
});
config.test!.include = [file];
config.resolve!.alias = [
  { find: /^@base-ui\/react\/scroll-area$/, replacement: resolve(import.meta.dirname, 'scroll-area-route.ts') },
  { find: /^\.\.\/\.\.\/direction-provider\/DirectionProvider$/, replacement: resolve(import.meta.dirname, 'ssr-additional-route.ts') },
  { find: /^\.\/ScrollAreaRootContext$/, replacement: resolve(import.meta.dirname, 'scroll-area-context-diagnostic.ts') },
  ...(config.resolve!.alias as Alias[]),
];
export default config;
