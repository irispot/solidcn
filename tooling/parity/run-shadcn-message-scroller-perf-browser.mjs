import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTest = 'shadcn-ui/packages/react/src/message-scroller/message-scroller.perf.browser.test.tsx';
const nativeComponent = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller.tsx');
const nativeGeometry = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller/geometry.ts');
const originalGeometry = resolve(root, 'shadcn-ui/packages/react/src/message-scroller/geometry.ts');
const reportPath = resolve(root, 'artifacts/unchanged-shadcn-message-scroller-perf-browser-comparison.json');
const browserVitest = resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-message-scroller-perf-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputPath = resolve(temporary, `${mode}.json`);
  const result = spawnSync(process.execPath, [browserVitest, 'run', '--config', config,
    originalTest, '--reporter=default', '--reporter=json', `--outputFile=${outputPath}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputPath, 'utf8')); }
  catch {
    errors.push(`${mode} produced no browser JSON report (exit ${result.status}): ${output.slice(-1000)}`);
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
  }
  const suite = report.testResults?.[0];
  if (report.testResults?.length !== 1 || relative(root, suite?.name ?? '') !== originalTest)
    errors.push(`${mode} did not report the exact unchanged performance test.`);
  const nativeCases = [...output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g)]
    .map((match) => {
      try { return JSON.parse(match[1]); }
      catch { return null; }
    }).filter(Boolean);
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests, passed: report.numPassedTests,
      failed: report.numFailedTests, skipped: report.numPendingTests },
    assertions: (suite?.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    routedComponentToNative: output.includes(`Solid message-scroller perf component route: ${nativeComponent}`),
    routedGeometryToNative: output.includes(`Solid message-scroller perf geometry route: ${nativeGeometry}`),
    loadedNativeGeometry: output.includes(`Solid message-scroller perf geometry loaded: ${nativeGeometry}`),
    nativeCases: nativeCases.map((item) => ({
      fullName: item.fullName,
      renders: item.renders,
      nativeExecutions: item.nativeExecutions,
    })),
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
    outputOnError: result.status ? output.slice(-4000) : undefined,
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react', 'tooling/parity/reference-shadcn-message-scroller-perf-browser.config.ts');
  const solid = run('solid', 'tooling/parity/dual-shadcn-message-scroller-perf-browser-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  if (readFileSync(nativeGeometry).compare(readFileSync(originalGeometry)) !== 0)
    errors.push('The Solid-owned geometry source is not an exact copy of the pinned original.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.total !== 6 || result.counts.passed !== 6 ||
        result.counts.failed !== 0 || result.counts.skipped !== 0 ||
        result.assertions.length !== 6 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} did not pass all six original performance assertions.`);
  }
  if (!solid.routedComponentToNative || !solid.routedGeometryToNative || !solid.loadedNativeGeometry)
    errors.push('The unchanged performance test did not load both native Solid sources.');
  if (solid.nativeCases.length !== 6 || solid.nativeCases.some((item) =>
      !item.nativeExecutions?.['shadcn-ui/packages/solid/src/internal/message-scroller.tsx#MessageScroller.Item']))
    errors.push('The performance test did not execute native Solid MessageScroller items in all six cases.');
  const identities = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid performance assertion identities or results differ.');
  const evidence = { success: errors.length === 0, originalTest,
    exactNativeGeometryCopy: readFileSync(nativeGeometry).compare(readFileSync(originalGeometry)) === 0,
    react, solid, inputHashBefore: before.digest, inputHashAfter: after.digest, errors };
  writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    nativeRoute: solid.routedComponentToNative && solid.routedGeometryToNative && solid.loadedNativeGeometry,
    nativeCaseEvidenceCount: solid.nativeCases.length, sourceHashStable: before.digest === after.digest,
    errors, artifact: relative(root, reportPath) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
