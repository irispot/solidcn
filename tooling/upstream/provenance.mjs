import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const directory = import.meta.dirname;
const root = resolve(directory, '../..');
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
const pins = JSON.parse(readFileSync(resolve(directory, manifest.baselineFile), 'utf8'));
const args = process.argv.slice(2);
const moduleFlag = args.indexOf('--module');
const selectedModule = moduleFlag < 0 ? undefined : args[moduleFlag + 1];
if (moduleFlag >= 0) args.splice(moduleFlag, 2);
const selectedRepo = args[0];
if (
  args.length > 1 ||
  (selectedRepo && !Object.hasOwn(pins, selectedRepo)) ||
  (moduleFlag >= 0 && !selectedModule)
) {
  throw new Error(
    'Usage: provenance.mjs [base-ui|shadcn-ui] [--module <workspace-relative-source-path>]',
  );
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workspacePath = (path) => relative(root, path).split('\\').join('/');
const isTest = (path) =>
  /(?:^|\/)(?:tests?|__tests__|test[-_]?utils)(?:\/|$)|(?:^|[./_-])(?:test|spec|snap)(?:[./_-]|$)/i.test(
    path,
  );
const sourceFile = (path) => /\.(?:[cm]?[jt]sx?|css)$/.test(path) && !isTest(path);
const git = (repo, params) =>
  execFileSync('git', ['-C', resolve(root, repo), ...params], { maxBuffer: 64 * 1024 * 1024 });
const trees = {};
for (const repo of selectedRepo ? [selectedRepo] : Object.keys(pins)) {
  trees[repo] = new Map(
    git(repo, ['ls-tree', '-r', '-z', pins[repo].commit])
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const split = entry.indexOf('\t');
        const [mode, type, blob] = entry.slice(0, split).split(' ');
        return [entry.slice(split + 1), { mode, type, blob }];
      })
      .filter(([, entry]) => entry.type === 'blob'),
  );
}
const scripts = new Map();
function script(path) {
  if (!scripts.has(path))
    scripts.set(
      path,
      existsSync(resolve(root, path))
        ? {
            path,
            sha256: hash(readFileSync(resolve(root, path))),
            role: 'Current migration script, not proof of output reproducibility.',
          }
        : { path, missing: true },
    );
  return scripts.get(path);
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(path, entry.name);
    return entry.isDirectory() ? walk(child) : entry.isFile() && sourceFile(child) ? [child] : [];
  });
}
function sources(repo, paths) {
  return [...new Set(paths)]
    .sort()
    .filter((path) => trees[repo].has(path))
    .map((path) => ({
      repository: repo,
      commit: pins[repo].commit,
      path,
      blob: trees[repo].get(path).blob,
      mode: trees[repo].get(path).mode,
    }));
}
function under(repo, prefixes) {
  return [...trees[repo].keys()].filter(
    (path) => sourceFile(path) && prefixes.some((prefix) => path.startsWith(prefix)),
  );
}
function historyScripts(repo, names) {
  return names.map((name) => script(`${repo}/packages/solid/scripts/${name}`));
}

function baseMapping(file) {
  const repo = 'base-ui';
  const config = manifest.repositories[repo];
  const groups = config.groups;
  const generator = () => [script(config.maintenance.entryPointGenerator)];
  if (file === 'tabs-indicator-prehydration-script.ts')
    return {
      classification: 'manual-native-prehydration-script',
      mappingScope: 'Pinned generated script and its template; Solid owns the export wrapper.',
      upstreamSources: sources(repo, [
        'packages/react/src/tabs/indicator/prehydrationScript.min.ts',
        'packages/react/src/tabs/indicator/prehydrationScript.template.js',
      ]),
      migrationScripts: [],
      manualFixesPresent: true,
    };
  if (file === 'tabs/types.ts')
    return {
      classification: 'manual-native-public-types',
      mappingScope: 'Pinned Tabs public type declarations translated to Solid callback and element props.',
      upstreamSources: sources(repo, [
        'packages/react/src/tabs/root/TabsRoot.tsx',
        'packages/react/src/tabs/indicator/TabsIndicator.tsx',
        'packages/react/src/tabs/tab/TabsTab.tsx',
        'packages/react/src/tabs/panel/TabsPanel.tsx',
        'packages/react/src/tabs/list/TabsList.tsx',
      ]),
      migrationScripts: [],
      manualFixesPresent: true,
    };
  const nativeTypes = file.match(/^(popover|tooltip|scroll-area|toolbar)\/types\.ts$/);
  if (nativeTypes) {
    const family = nativeTypes[1];
    return {
      classification: 'manual-native-public-types',
      mappingScope: 'Pinned family type declarations translated to native Solid types; name coverage is not type or behavior acceptance.',
      families: [family],
      upstreamSources: sources(repo, under(repo, [`packages/react/src/${family}/`])),
      migrationScripts: [],
      manualFixesPresent: true,
    };
  }
  if (/^slider\/utils\/(?:asc|clamp|getPushedThumbValues|getSliderValue|resolveThumbCollision|roundValueToStep|validateMinimumDistance)\.ts$/.test(file)) {
    const name = file.split('/').at(-1);
    const source = name === 'clamp.ts'
      ? 'packages/utils/src/clamp.ts'
      : `packages/react/src/${file}`;
    return {
      classification: 'replayed-framework-neutral-slider-helper',
      mappingScope: 'Pinned helper source with only local import and Solid-owned type edits where required.',
      families: ['slider'],
      upstreamSources: sources(repo, [source]),
      migrationScripts: [],
      manualFixesPresent: ['getPushedThumbValues.ts', 'getSliderValue.ts', 'resolveThumbCollision.ts'].includes(name),
    };
  }
  if (Object.hasOwn(groups, file)) {
    const families = groups[file];
    const prefixes = families.map((family) => `${config.sourcePrefix}${family}/`);
    if (file === 'core.tsx') prefixes.push('packages/react/src/utils/', 'packages/utils/src/');
    return {
      classification:
        file === 'merge-props/mergeProps.ts'
          ? 'manual-native-utility'
          : 'manual-grouped-native-implementation',
      mappingScope:
        'Family-level review relationship. It is not an exact function or copied-source mapping.',
      families,
      upstreamSources: sources(repo, [
        ...under(repo, prefixes),
        ...(config.referenceFiles?.[file] ?? []),
      ]),
      migrationScripts: [],
      manualFixesPresent: true,
    };
  }
  if (file === 'index.ts')
    return {
      classification: 'generated-public-entry-with-manual-maintenance',
      mappingScope: 'Public export reference only.',
      upstreamSources: sources(repo, ['packages/react/src/index.ts']),
      migrationScripts: generator(),
      manualFixesPresent: true,
    };
  const match = file.match(/^([^/]+)\/index\.ts$/);
  if (match) {
    const family = match[1];
    const group = Object.entries(groups).find(([, values]) => values.includes(family))?.[0];
    const generated =
      group && !['controls.tsx', 'selection.tsx', 'merge-props/mergeProps.ts'].includes(group);
    return {
      classification: generated
        ? 'generated-public-entry-with-manual-maintenance'
        : 'manual-native-public-entry',
      mappingScope: 'Public export reference only.',
      upstreamSources: sources(repo, [`packages/react/src/${family}/index.ts`]),
      migrationScripts: generated ? generator() : [],
      manualFixesPresent: true,
    };
  }
  return null;
}

function shadcnMapping(file) {
  const repo = 'shadcn-ui';
  const maintenance = manifest.repositories[repo].maintenance;
  if (file === 'internal/message-scroller/geometry.ts' ||
      file === 'internal/message-scroller/types.ts') {
    const source = `packages/react/src/message-scroller/${file.endsWith('geometry.ts') ? 'geometry.ts' : 'types.ts'}`;
    return {
      classification: file.endsWith('geometry.ts') ? 'exact-framework-neutral-source-copy' : 'manual-solid-type-shim',
      mappingScope: file.endsWith('geometry.ts')
        ? 'Exact pinned source bytes; adjacent types are Solid-owned.'
        : 'Only the geometry constants and framework-neutral types are needed; no React types are copied.',
      upstreamSources: sources(repo, [source]),
      migrationScripts: [],
      manualFixesPresent: !file.endsWith('geometry.ts'),
    };
  }
  const canonical = 'apps/v4/registry/bases/base/ui/';
  const legacy = 'apps/v4/registry/new-york-v4/ui/';
  const transforms = [
    'convert-registry.mjs',
    'finalize-v2.mjs',
    'render-props.mjs',
    'data-attributes.mjs',
  ];
  const externalEngines = {
    'calendar.tsx': 'react-day-picker',
    'carousel.tsx': 'embla-carousel-react',
    'chart.tsx': 'recharts',
    'sonner.tsx': 'sonner',
    'form.tsx': 'react-hook-form',
    'internal/command.tsx': 'cmdk',
    'internal/input-otp.tsx': 'input-otp',
    'internal/resizable.tsx': 'react-resizable-panels',
  };
  if (/^styles\/style-[^/]+\.css$/.test(file) || file === 'styles/tailwind.css') {
    const source =
      file === 'styles/tailwind.css'
        ? 'packages/shadcn/src/tailwind.css'
        : `apps/v4/registry/${file}`;
    return {
      classification: 'copied-stylesheet',
      mappingScope: 'Exact source file intended; byte comparison is recorded.',
      upstreamSources: sources(repo, [source]),
      migrationScripts: historyScripts(repo, [
        file === 'styles/tailwind.css' ? 'copy-styles.mjs' : 'convert-registry.mjs',
      ]),
      manualFixesPresent: null,
      compareCopy: true,
    };
  }
  if (file === 'styles/theme.css' || file === 'styles.css')
    return {
      classification:
        file === 'styles/theme.css'
          ? 'extracted-theme-with-manual-additions'
          : 'manual-stylesheet-integration',
      mappingScope: 'Theme extraction and integration references, not a byte-for-byte copy.',
      upstreamSources: sources(repo, [
        'apps/v4/app/globals.css',
        'packages/shadcn/src/tailwind.css',
        'apps/v4/registry/styles/style-nova.css',
      ]),
      migrationScripts:
        file === 'styles/theme.css' ? historyScripts(repo, ['copy-styles.mjs']) : [],
      manualFixesPresent: true,
    };
  if (file === 'index.ts')
    return {
      classification: 'generated-public-entry-with-manual-maintenance',
      mappingScope: 'Registry export references; generated output was corrected manually.',
      upstreamSources: sources(repo, under(repo, [canonical, legacy])),
      migrationScripts: historyScripts(repo, ['inventory.mjs']),
      manualFixesPresent: true,
    };
  if (file === 'icon-data.ts') {
    const data = readFileSync(resolve(root, repo, 'packages/solid/src/icon-data.ts'), 'utf8');
    const declaredHashes = data.match(/^\/\/ Source hashes: (.+)$/m)?.[1];
    const packageRoot = resolve(root, 'tooling/visual/apps/reference/node_modules/lucide-react');
    const packageFile = resolve(packageRoot, 'package.json');
    const referenceLock = resolve(root, 'tooling/visual/apps/reference/package-lock.json');
    const license = `${repo}/packages/solid/LUCIDE-LICENSE`;
    return {
      classification: 'generated-external-svg-data',
      mappingScope:
        'Pinned Base registry files select the icon names. SVG geometry comes from the separate lucide-react package, not these Git blobs. Candidate replay is not integrated.',
      upstreamSources: sources(repo, under(repo, [canonical])),
      migrationScripts: [
        script('tooling/generate-icons.mjs'),
        script('tooling/visual/docs/icons.mjs'),
      ],
      manualFixesPresent: false,
      externalInputs: {
        package: 'lucide-react',
        pinnedVersion: '0.474.0',
        installedVersion: existsSync(packageFile)
          ? JSON.parse(readFileSync(packageFile, 'utf8')).version
          : null,
        declaredSourceSha256: declaredHashes ? JSON.parse(declaredHashes) : {},
        declaredHashesVerifiedHere: false,
        verificationCommand: 'node tooling/generate-icons.mjs --check',
        verificationScope:
          'Separate current-registry and installed-package byte check. It is not a candidate Git-ref replay or behavior check.',
        referenceLockSha256: existsSync(referenceLock) ? hash(readFileSync(referenceLock)) : null,
        license: {
          path: license,
          sha256: existsSync(resolve(root, license))
            ? hash(readFileSync(resolve(root, license)))
            : null,
        },
      },
    };
  }
  const special = {
    'utils.ts': ['apps/v4/registry/bases/base/lib/utils.ts'],
    'use-mobile.ts': ['apps/v4/registry/bases/base/hooks/use-mobile.ts'],
    'icons.tsx': ['apps/v4/app/(app)/(create)/components/icon-placeholder.tsx'],
  };
  if (special[file])
    return {
      classification: 'manual-native-support',
      mappingScope: 'API or integration reference; native helpers contain additional code.',
      upstreamSources: sources(repo, special[file]),
      migrationScripts: [],
      manualFixesPresent: true,
      ...(file === 'icons.tsx'
        ? {
            nativeGeometryModule: 'shadcn-ui/packages/solid/src/icon-data.ts',
            externalSourceScope:
              'Icon data has a separate record and installed-package check. This renderer remains manually maintained.',
          }
        : {}),
    };
  const basename = file.replace(/^internal\//, '');
  const source = trees[repo].has(`${canonical}${basename}`)
    ? `${canonical}${basename}`
    : `${legacy}${basename}`;
  const extra =
    file === 'internal/questionnaire.tsx'
      ? under(repo, ['packages/react/src/questionnaire/'])
      : file === 'internal/message-scroller.tsx'
        ? under(repo, ['packages/react/src/message-scroller/'])
        : [];
  const refs = sources(repo, [source, ...extra]);
  if (!refs.length) return null;
  const manual = maintenance.manualNativeEngines.includes(file);
  return {
    classification: manual
      ? 'manual-native-engine-replacement'
      : 'generated-wrapper-with-manual-fixes',
    mappingScope: manual
      ? 'Original registry or engine API reference; this is a separate native implementation.'
      : 'Registry source selected with Base first, legacy only if the Base file does not exist.',
    upstreamSources: refs,
    migrationScripts: manual ? [] : historyScripts(repo, transforms),
    manualFixesPresent: true,
    knownManualWrapperFix: maintenance.knownManualWrapperFixes.includes(file),
    ...(externalEngines[file]
      ? {
          missingExternalSource: `The ${externalEngines[file]} engine source is not pinned as source blobs in these clones.`,
        }
      : {}),
  };
}

const modules = [];
for (const repo of Object.keys(trees)) {
  const nativeRoot = resolve(root, repo, manifest.repositories[repo].portRoot);
  for (const absolute of walk(nativeRoot).sort()) {
    if (selectedModule && workspacePath(absolute) !== selectedModule) continue;
    const local = relative(nativeRoot, absolute).split('\\').join('/');
    const mapped = (repo === 'base-ui' ? baseMapping(local) : shadcnMapping(local)) ?? {
      classification: 'unmapped-native-source',
      mappingScope: 'No explicit source relationship is known.',
      upstreamSources: [],
      migrationScripts: [],
      manualFixesPresent: null,
    };
    const currentSha256 = hash(readFileSync(absolute));
    const record = {
      module: workspacePath(absolute),
      currentSha256,
      mappingStatus: mapped.upstreamSources.length ? 'mapped-reference' : 'unmapped',
      ...mapped,
      generatorReplayVerified: false,
      manualPatchLedgerComplete: false,
    };
    if (mapped.compareCopy && mapped.upstreamSources.length === 1) {
      const original = hash(git(repo, ['cat-file', 'blob', mapped.upstreamSources[0].blob]));
      record.pinnedSourceSha256 = original;
      record.copyBytesMatchPinnedSource = original === currentSha256;
      if (!record.copyBytesMatchPinnedSource) {
        record.classification = 'copied-stylesheet-with-local-changes';
        record.manualFixesPresent = true;
        record.copyChangeSemanticsReviewed = false;
      }
    }
    delete record.compareCopy;
    modules.push(record);
  }
}
if (selectedModule && !modules.length)
  throw new Error(`Native source module not found: ${selectedModule}`);
console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      mode: 'read-only-current-provenance',
      pins,
      nativeModuleCount: modules.length,
      unmappedModules: modules
        .filter((item) => item.mappingStatus === 'unmapped')
        .map((item) => item.module),
      copyMismatches: modules
        .filter((item) => item.copyBytesMatchPinnedSource === false)
        .map((item) => item.module),
      scripts: [...scripts.values()],
      modules,
      limits: [
        'Mappings identify review sources, not exact function origin or behavior equivalence.',
        'Current script hashes describe preserved migration history; replay is not verified.',
        'Manual fixes are not reconstructible from a complete patch ledger yet.',
        'External React engine implementations are not vendored or mapped to source blobs here.',
        'This command does not fetch, generate, change refs, update baselines, or write files.',
      ],
    },
    null,
    2,
  ),
);
