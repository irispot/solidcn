import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const directory = import.meta.dirname;
export const workspace = resolve(directory, '../..');
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const pins = () => readJson(resolve(directory, '../parity/upstreams.json'));
export const git = (repository, arguments_) =>
  execFileSync('git', ['-C', resolve(workspace, repository), ...arguments_], {
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
export function safeInside(root, path) {
  const result = resolve(root, path);
  if (!result.startsWith(`${resolve(root)}${sep}`))
    throw new Error(`Path is outside the permitted directory: ${path}`);
  return result;
}
export function moduleParts(module) {
  const match = module.match(/^(base-ui|shadcn-ui)\/packages\/solid\/src\/(.+)$/);
  if (
    !match ||
    match[2].split('/').includes('..') ||
    /(?:^|[./_-])(?:test|spec|snap)(?:[./_-]|$)/i.test(match[2])
  )
    throw new Error(`Not an allowed native source module: ${module}`);
  return { repository: match[1], local: match[2] };
}
export const recordPath = (module) => {
  const { repository, local } = moduleParts(module);
  return safeInside(resolve(directory, 'records'), `${repository}/${local}.json`);
};
export const recipePath = (module) => {
  const { repository, local } = moduleParts(module);
  return safeInside(resolve(directory, 'recipes'), `${repository}/${local}.json`);
};
export function listJson(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(root, entry.name);
      return entry.isDirectory()
        ? listJson(path)
        : entry.isFile() && entry.name.endsWith('.json')
          ? [path]
          : [];
    })
    .sort();
}
export function currentProvenance() {
  return JSON.parse(
    execFileSync(process.execPath, [resolve(directory, 'provenance.mjs')], {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
    }),
  );
}
export function resolveCommit(repository, reference) {
  if (!Object.hasOwn(pins(), repository))
    throw new Error('Repository must be base-ui or shadcn-ui.');
  return git(repository, ['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`])
    .toString()
    .trim();
}
export function tree(repository, commit) {
  return new Map(
    git(repository, ['ls-tree', '-r', '-z', commit])
      .toString()
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const split = entry.indexOf('\t');
        const [mode, type, blob] = entry.slice(0, split).split(' ');
        return [entry.slice(split + 1), { mode, type, blob }];
      })
      .filter(([, value]) => value.type === 'blob'),
  );
}
export function loadRecipe(module) {
  const path = recipePath(module);
  if (!existsSync(path)) return null;
  const recipe = readJson(path);
  if (
    recipe.schemaVersion !== 1 ||
    recipe.module !== module ||
    !recipe.generator?.startsWith('generators/') ||
    !Array.isArray(recipe.generatorInputs) ||
    !recipe.generatorInputs.length
  )
    throw new Error(`Invalid recipe: ${path}`);
  for (const path of [
    recipe.generator,
    ...(recipe.supportFiles ?? []),
    ...(recipe.overrides ?? []),
  ])
    safeInside(directory, path);
  return { ...recipe, recipeFile: relative(directory, path).split(sep).join('/') };
}
export function toolchain(recipe) {
  const files = [
    'replay.mjs',
    'replay-lib.mjs',
    recipe.recipeFile,
    recipe.generator,
    ...(recipe.supportFiles ?? []),
    ...(recipe.overrides ?? []),
  ];
  return {
    files: [...new Set(files)].map((path) => ({
      path,
      sha256: hash(readFileSync(safeInside(directory, path))),
    })),
    dependencies: Object.fromEntries(
      (recipe.dependencies ?? []).map((name) => [
        name,
        readJson(resolve(workspace, 'node_modules', name, 'package.json')).version,
      ]),
    ),
    dependencyLockSha256: hash(readFileSync(resolve(workspace, 'package-lock.json'))),
  };
}
export function applyExactOverride(code, override, path = 'override') {
  if (override.schemaVersion !== 1 || !override.purpose || !Array.isArray(override.replacements))
    throw new Error(`Invalid exact-context override: ${path}`);
  for (const replacement of override.replacements) {
    if (
      typeof replacement.find !== 'string' ||
      !replacement.find.length ||
      typeof replacement.replace !== 'string' ||
      !Number.isInteger(replacement.expectedOccurrences) ||
      replacement.expectedOccurrences < 1
    )
      throw new Error(`Invalid replacement in ${path}`);
    const occurrences = code.split(replacement.find).length - 1;
    if (occurrences !== replacement.expectedOccurrences)
      throw new Error(
        `Override ${path} expected ${replacement.expectedOccurrences} exact contexts, found ${occurrences}. Review the candidate; no fuzzy patch was applied.`,
      );
    code = code.split(replacement.find).join(replacement.replace);
  }
  return code;
}
export async function regenerate(module, commit) {
  const recipe = loadRecipe(module);
  if (!recipe) return null;
  const { repository } = moduleParts(module);
  const entries = tree(repository, commit);
  const inputs = recipe.generatorInputs.map((path) => {
    const entry = entries.get(path);
    if (!entry) throw new Error(`Generator input is absent at ${commit}: ${path}`);
    return {
      path,
      blob: entry.blob,
      code: git(repository, ['cat-file', 'blob', entry.blob]).toString('utf8'),
    };
  });
  const generator = await import(pathToFileURL(safeInside(directory, recipe.generator)).href);
  if (typeof generator.generate !== 'function')
    throw new Error(`Generator must export generate(): ${recipe.generator}`);
  const generated = await generator.generate({ inputs, options: recipe.options ?? {} });
  if (typeof generated !== 'string') throw new Error('Generator output must be text.');
  let code = generated;
  const overrides = [];
  for (const path of recipe.overrides ?? []) {
    const override = readJson(safeInside(directory, path));
    code = applyExactOverride(code, override, path);
    overrides.push({
      path,
      purpose: override.purpose,
      sha256: hash(readFileSync(safeInside(directory, path))),
    });
  }
  return { code, generated, inputs, overrides, recipe, toolchain: toolchain(recipe) };
}
export async function proposeRecord(provenance) {
  const { repository } = moduleParts(provenance.module);
  const commit = pins()[repository].commit;
  const replay = await regenerate(provenance.module, commit);
  const equality = !!replay && hash(replay.code) === provenance.currentSha256;
  return {
    schemaVersion: 1,
    module: provenance.module,
    repository,
    pinnedCommit: commit,
    nativeSha256: provenance.currentSha256,
    classification: provenance.classification,
    mappingScope: provenance.mappingScope,
    ...(provenance.externalInputs ? { externalInputs: provenance.externalInputs } : {}),
    ...(provenance.nativeGeometryModule
      ? { nativeGeometryModule: provenance.nativeGeometryModule }
      : {}),
    review: {
      state: equality ? 'replay-equality-confirmed' : 'manual-review-pending',
      acceptedBehavior: false,
      evidence: equality
        ? [
            'node tooling/upstream/replay.mjs check',
            'Pinned source regeneration equals the recorded native bytes. This is not behavior or visual acceptance.',
          ]
        : [],
    },
    sources: provenance.upstreamSources.map(({ path, blob, mode }) => ({
      path,
      blob,
      mode,
      review:
        equality && replay.inputs.some((input) => input.path === path)
          ? 'replay-input-equality-confirmed'
          : 'pending',
    })),
    replay: replay
      ? {
          recipeFile: replay.recipe.recipeFile,
          toolchain: replay.toolchain,
          generatedSha256: hash(replay.generated),
          finalSha256: hash(replay.code),
          equalsNative: equality,
          overrides: replay.overrides,
        }
      : null,
    manualException: equality
      ? null
      : {
          reason: provenance.mappingScope,
          retainLiveImplementation: true,
          sourceReview: 'pending',
          behaviorTranslation: 'not automatic',
          patchHistory: 'not reconstructed; this hash is an observation, not a generator',
          ...(provenance.missingExternalSource
            ? { missingExternalSource: provenance.missingExternalSource }
            : {}),
        },
  };
}
