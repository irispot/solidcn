import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const directory = import.meta.dirname;
const root = resolve(directory, '../..');
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
const baselines = JSON.parse(readFileSync(resolve(directory, manifest.baselineFile), 'utf8'));
const [command = 'status', repository, ...arguments_] = process.argv.slice(2);
const git = (repo, args) =>
  execFileSync('git', ['-C', resolve(root, repo), ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const splitNul = (value) => value.split('\0').filter(Boolean);
const relativePath = (path) => relative(root, path).split('\\').join('/');
const isProtected = (path) =>
  /(^|\/)(?:tests?|__tests__|__snapshots__|test[-_]?utils)(?:\/|$)/i.test(path) ||
  /(?:^|[./_-])(?:test|spec|snap)(?:[./_-]|$)/i.test(path) ||
  /(?:^|\/)(?:vitest|jest|playwright|karma|cypress)(?:[./_-]|$)/i.test(path) ||
  /(?:^|\/)test[-_]?utils(?:[./_-]|$)/i.test(path);

function filesUnder(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(path, entry.name);
    return entry.isDirectory()
      ? filesUnder(child)
      : /\.(?:[cm]?[jt]sx?|css)$/.test(child)
        ? [child]
        : [];
  });
}
const nativeFiles = Object.entries(manifest.repositories).flatMap(([name, config]) =>
  filesUnder(resolve(root, name, config.portRoot)),
);
const nativeSet = new Set(nativeFiles);
const dependents = new Map();
for (const file of nativeFiles) {
  if (extname(file) === '.css') continue;
  const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
  for (const { fileName } of info.importedFiles) {
    let target;
    if (fileName.startsWith('.')) target = resolve(dirname(file), fileName);
    else if (fileName === '@solid-cn/base-ui')
      target = resolve(root, 'base-ui/packages/solid/src/index');
    else if (fileName.startsWith('@solid-cn/base-ui/'))
      target = resolve(
        root,
        'base-ui/packages/solid/src',
        fileName.slice('@solid-cn/base-ui/'.length),
        'index',
      );
    else if (fileName.startsWith('@solid-cn/ui/'))
      target = resolve(
        root,
        'shadcn-ui/packages/solid/src',
        fileName.slice('@solid-cn/ui/'.length),
      );
    if (!target) continue;
    const found = [
      target,
      `${target}.ts`,
      `${target}.tsx`,
      `${target}.css`,
      resolve(target, 'index.ts'),
      resolve(target, 'index.tsx'),
    ].find((candidate) => nativeSet.has(candidate));
    if (!found) continue;
    const consumers = dependents.get(found) ?? new Set();
    consumers.add(file);
    dependents.set(found, consumers);
  }
}

function directTargets(repo, path) {
  const config = manifest.repositories[repo];
  const port = resolve(root, repo, config.portRoot);
  const targets = new Set();
  let reason = 'No explicit mapping. Review this path before accepting the candidate.';
  if (repo === 'base-ui') {
    const family = path.startsWith(config.sourcePrefix)
      ? path.slice(config.sourcePrefix.length).split('/')[0]
      : undefined;
    const module = Object.entries(config.groups).find(([, families]) =>
      families.includes(family),
    )?.[0];
    if (module) {
      targets.add(resolve(port, module));
      targets.add(resolve(port, family, 'index.ts'));
      reason = `Base UI ${family} source or colocated test maps to its native family module.`;
    } else if (
      config.sharedPrefixes.some((prefix) => path.startsWith(prefix)) ||
      config.sharedFiles.includes(path) ||
      isProtected(path)
    ) {
      for (const module of Object.keys(config.groups)) targets.add(resolve(port, module));
      reason =
        'Shared implementation, dependency, or test infrastructure: review all Base UI family modules.';
    }
  } else {
    const match = config.componentPatterns
      .map((pattern) => path.match(new RegExp(pattern)))
      .find(Boolean);
    if (match) {
      targets.add(resolve(port, `${match[1]}.tsx`));
      for (const extra of config.extraTargets[match[1]] ?? []) targets.add(resolve(port, extra));
      reason = `shadcn ${match[1]} registry component maps to its native wrapper and local support modules.`;
    } else if (
      config.sharedPatterns.some((pattern) => new RegExp(pattern).test(path)) ||
      isProtected(path)
    ) {
      for (const file of nativeFiles.filter((file) => file.startsWith(`${port}/`)))
        targets.add(file);
      reason =
        'Shared registry, style, dependency, or test infrastructure: review all shadcn modules.';
    }
  }
  const indirect = new Set(targets);
  const pending = [...targets];
  while (pending.length) {
    for (const file of dependents.get(pending.shift()) ?? []) {
      if (!indirect.has(file)) {
        indirect.add(file);
        pending.push(file);
      }
    }
  }
  return {
    path,
    category: isProtected(path)
      ? 'protected-test-or-runner'
      : /\.(?:[cm]?[jt]sx?|css|json)$/.test(path)
        ? 'source-or-configuration'
        : 'documentation-or-other',
    reason,
    directModules: [...targets].map(relativePath).sort(),
    dependentModules: [...indirect]
      .filter((file) => !targets.has(file))
      .map(relativePath)
      .sort(),
    missingTargets: [...targets]
      .filter((file) => !existsSync(file))
      .map(relativePath)
      .sort(),
  };
}

function changes(repo, from, to, cached = false) {
  const parts = splitNul(
    git(repo, [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--name-status',
      '--no-renames',
      '-z',
      ...(cached ? ['--cached'] : []),
      from,
      ...(to ? [to] : []),
      '--',
    ]),
  );
  const result = [];
  for (let index = 0; index < parts.length; index += 2)
    result.push({ status: parts[index], path: parts[index + 1] });
  return result;
}

function status(repo) {
  const baseline = baselines[repo];
  const config = manifest.repositories[repo];
  const allChanges = changes(repo, baseline.commit);
  const nativePrefix = `${config.portRoot.slice(0, config.portRoot.lastIndexOf('/'))}/`;
  const originalTrackedChanges = allChanges.filter(
    (change) => !change.path.startsWith(nativePrefix),
  );
  const originalIndexChanges = changes(repo, baseline.commit, undefined, true).filter(
    (change) => !change.path.startsWith(nativePrefix),
  );
  return {
    repository: repo,
    origin: baseline.origin,
    pinnedCommit: baseline.commit,
    head: git(repo, ['rev-parse', '--verify', 'HEAD']).trim(),
    trackedOriginalsUnchanged:
      originalTrackedChanges.length === 0 && originalIndexChanges.length === 0,
    originalTrackedChanges,
    originalIndexChanges,
    separatePortChanges: allChanges.filter((change) => change.path.startsWith(nativePrefix)),
    localStatus: git(repo, ['status', '--porcelain=v1', '--untracked-files=normal'])
      .trimEnd()
      .split('\n')
      .filter(Boolean),
  };
}

try {
  if (repository && !Object.hasOwn(manifest.repositories, repository))
    throw new Error(`Unknown repository ${repository}. Choose base-ui or shadcn-ui.`);
  if (command === 'status') {
    if (arguments_.length) throw new Error('Usage: impact.mjs status [base-ui|shadcn-ui]');
    const repositories = (repository ? [repository] : Object.keys(manifest.repositories)).map(
      status,
    );
    console.log(JSON.stringify({ mode: 'read-only-status', repositories }, null, 2));
    if (repositories.some((item) => !item.trackedOriginalsUnchanged)) process.exitCode = 1;
  } else if (command === 'map') {
    if (!repository || !arguments_.length)
      throw new Error('Usage: impact.mjs map <repository> <upstream-path> [...]');
    console.log(
      JSON.stringify(
        {
          mode: 'read-only-path-map',
          repository,
          mappings: arguments_.map((path) => directTargets(repository, path)),
        },
        null,
        2,
      ),
    );
  } else if (command === 'compare') {
    if (!repository || arguments_.length !== 1)
      throw new Error('Usage: impact.mjs compare <repository> <local-ref-or-commit>');
    const pinnedCommit = baselines[repository].commit;
    const suppliedRef = arguments_[0];
    const candidateCommit = git(repository, [
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${suppliedRef}^{commit}`,
    ]).trim();
    const changed = changes(repository, pinnedCommit, candidateCommit).map((change) => ({
      ...directTargets(repository, change.path),
      status: change.status,
    }));
    console.log(
      JSON.stringify(
        {
          mode: 'read-only-candidate-impact',
          repository,
          pinnedCommit,
          suppliedRef,
          candidateCommit,
          changedFiles: changed.length,
          protectedChanges: changed
            .filter((item) => item.category === 'protected-test-or-runner')
            .map((item) => item.path),
          baselineReviewRequired: candidateCommit !== pinnedCommit,
          directModules: [...new Set(changed.flatMap((item) => item.directModules))].sort(),
          dependentModules: [...new Set(changed.flatMap((item) => item.dependentModules))].sort(),
          unmappedChanges: changed
            .filter((item) => item.directModules.length === 0)
            .map((item) => item.path),
          changes: changed,
          localState: status(repository),
          note: 'No refs or files changed. Mapping is conservative, not proof of compatibility. Baseline files remain pinned.',
        },
        null,
        2,
      ),
    );
  } else throw new Error('Commands: status, compare, map. See tooling/upstream/README.md.');
} catch (error) {
  console.error(error.stderr?.toString().trim() || error.message);
  process.exitCode = 1;
}
