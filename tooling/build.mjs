import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { transformAsync } from '@babel/core';
import solid from '@solidjs/babel-plugin';
import typescript from '@babel/preset-typescript';
const root = resolve(import.meta.dirname, '..');
const packages = ['base-ui/packages/solid', 'shadcn-ui/packages/solid'];
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? files(resolve(dir, entry.name)) : resolve(dir, entry.name),
      ),
    )
  ).flat();
}
const include = packages.map((path) => `${path}/src`);
execFileSync(process.execPath, [resolve(root, 'tooling/parity/preserve.mjs'), 'verify'], {
  cwd: root,
  stdio: 'inherit',
});
for (const pkg of packages) {
  const source = resolve(root, pkg, 'src');
  const paths = await files(source);
  for (const mode of ['dom', 'ssr']) {
    const target = resolve(root, pkg, mode === 'ssr' ? 'dist/server' : 'dist');
    for (const path of paths) {
      const name = relative(source, path);
      if (!/\.(tsx?|css)$/.test(path) || path.endsWith('.d.ts')) continue;
      const output = resolve(target, name.replace(/\.tsx?$/, '.js'));
      await mkdir(dirname(output), { recursive: true });
      if (path.endsWith('.css')) {
        await copyFile(path, output);
        continue;
      }
      const code = await readFile(path, 'utf8');
      if (/from\s+['"](?:react(?:-dom)?(?:\/[^'"]*)?|@base-ui\/react(?:\/[^'"]*)?)['"]/.test(code))
        throw new Error(`React runtime import in ${name}`);
      const result = await transformAsync(code, {
        filename: path,
        configFile: false,
        babelrc: false,
        sourceMaps: true,
        plugins: [[solid, { generate: mode, hydratable: true }]],
        presets: [
          [
            typescript,
            { allExtensions: true, isTSX: path.endsWith('.tsx'), onlyRemoveTypeImports: true },
          ],
        ],
      });
      const compiled = result.code.replace(
        /((?:from\s+|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
        (match, before, value, after) => {
          if (extname(value)) return match;
          const resolved = resolve(dirname(path), value);
          return `${before}${value}${existsSync(`${resolved}.tsx`) || existsSync(`${resolved}.ts`) ? '.js' : '/index.js'}${after}`;
        },
      );
      await writeFile(
        output,
        `${compiled}\n//# sourceMappingURL=${output.split('/').at(-1)}.map\n`,
      );
      await writeFile(`${output}.map`, JSON.stringify(result.map));
    }
  }
  const config = resolve(root, pkg, 'tsconfig.build.json');
  await writeFile(
    config,
    JSON.stringify(
      {
        extends: '../../../tsconfig.json',
        compilerOptions: {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          declarationMap: true,
          rootDir: 'src',
          outDir: 'dist',
          paths: pkg.startsWith('shadcn')
            ? {
                '@solid-cn/base-ui': ['base-ui/packages/solid/dist/index.d.ts'],
                '@solid-cn/base-ui/*': ['base-ui/packages/solid/dist/*/index.d.ts'],
              }
            : {},
        },
        include: ['src'],
        exclude: ['dist'],
      },
      null,
      2,
    ) + '\n',
  );
  // TypeScript path entries resolve from the root config when provided an explicit baseUrl.
  const json = JSON.parse(await readFile(config, 'utf8'));
  json.compilerOptions.baseUrl = '../../..';
  await writeFile(config, JSON.stringify(json, null, 2) + '\n');
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', config], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(`Built ${pkg}: native Solid client, server, and TypeScript declarations.`);
}
