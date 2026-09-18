import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';

const root = resolve(import.meta.dirname, '../..');
const names = ['getPushedThumbValues', 'getSliderValue', 'resolveThumbCollision', 'roundValueToStep'];
const expectedFiles = names.map((name) => `base-ui/packages/react/src/slider/utils/${name}.test.ts`).sort();
const nativeDirectory = resolve(root, 'base-ui/packages/solid/src/slider/utils');
const reportPath = resolve(root, 'artifacts/unchanged-slider-utils-comparison.json');
const scratch = mkdtempSync(resolve(tmpdir(), 'solid-cn-slider-utils-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function command(args) {
  return spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
}

function guard(stage) {
  const result = command(['tooling/parity/preserve.mjs', 'verify']);
  if (result.status !== 0) errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputPath = resolve(scratch, `${mode}.json`);
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), [
    'run', '--config', config, '--reporter=default', '--reporter=json', `--outputFile=${outputPath}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try { report = JSON.parse(readFileSync(outputPath, 'utf8')); }
  catch {
    report = { testResults: [] };
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
  }
  const suites = (report.testResults ?? []).map((suite) => ({
    file: relative(root, suite.name).replaceAll('\\', '/'),
    assertions: (suite.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
  })).sort((a, b) => a.file.localeCompare(b.file));
  if (JSON.stringify(suites.map((suite) => suite.file)) !== JSON.stringify(expectedFiles))
    errors.push(`${mode} did not load all four unchanged slider utility tests.`);
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    suites,
    routedToNative: names.every((name) => output.includes(`Native slider helper route: ${resolve(nativeDirectory, `${name}.ts`)}`)),
    loadedNative: names.every((name) => output.includes(`Native slider helper loaded: ${resolve(nativeDirectory, `${name}.ts`)}`)),
    outputOnError: result.status ? output.slice(-3000) : undefined,
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react', 'tooling/parity/reference-slider-utils.config.ts');
  const solid = run('solid', 'tooling/parity/dual-slider-utils-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  for (const [mode, run] of [['React', react], ['Solid', solid]]) {
    if (run.exitCode !== 0 || run.counts.failed !== 0 || run.counts.total !== 24 ||
        run.counts.passed !== 24 || run.counts.skipped !== 0)
      errors.push(`${mode} did not pass all 24 unchanged slider utility assertions.`);
  }
  if (!solid.routedToNative || !solid.loadedNative)
    errors.push('The unchanged tests did not load all four native helper modules.');
  const identities = (run) => run.suites.flatMap((suite) =>
    suite.assertions.map((item) => `${suite.file}\u0000${item.fullName}\u0000${item.status}`)).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid assertion identities or results differ.');
  const evidence = {
    success: errors.length === 0,
    originalTestFiles: expectedFiles,
    react, solid,
    inputHashBefore: before.digest,
    inputHashAfter: after.digest,
    errors,
  };
  writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: react.counts,
    solid: solid.counts,
    nativeRoute: solid.routedToNative && solid.loadedNative,
    sourceHashStable: before.digest === after.digest,
    errors,
    artifact: relative(root, reportPath),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
