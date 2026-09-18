import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import referenceConfig from './reference.config.ts';

const isolatedDependencies = resolve(import.meta.dirname, 'reference-deps/node_modules');
const reactSource = resolve(import.meta.dirname, '../../base-ui/packages/react/src');
const config = mergeConfig(referenceConfig, {
  test: {
    name: 'all-unchanged-react-reference-jsdom',
    include: [
      'base-ui/packages/react/src/**/*.test.{ts,tsx}',
      'base-ui/packages/react/test/**/*.test.{ts,tsx}',
    ],
    server: { deps: { inline: ['@base-ui/react'] } },
    maxWorkers: 4,
    minWorkers: 1,
  },
});
config.test!.include = [
  'base-ui/packages/react/src/**/*.test.{ts,tsx}',
  'base-ui/packages/react/test/**/*.test.{ts,tsx}',
];
config.resolve!.alias = [
  { find: /^@base-ui\/react\/(.+)$/, replacement: `${reactSource}/$1` },
  ...(referenceConfig.resolve?.alias as Exclude<typeof config.resolve.alias, undefined>).slice(1),
  ...['@date-fns/tz', 'date-fns', 'luxon', 'react-router', 'vitest-browser-react'].map((name) => ({
    find: new RegExp(`^${name}(?=/|$)`),
    replacement: resolve(isolatedDependencies, name),
  })),
];
export default config;
