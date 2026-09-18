import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTest = 'shadcn-ui/packages/react/src/questionnaire/questionnaire.browser.test.tsx';
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/questionnaire.tsx');
const reportPath = resolve(root, 'artifacts/unchanged-shadcn-questionnaire-browser-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-questionnaire-browser-'));
const browserVitest = resolve(root, 'tooling/parity/shadcn-browser-deps/node_modules/vitest/vitest.mjs');
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
    errors.push(`${mode} did not report the exact unchanged Questionnaire browser test.`);
  return {
    exitCode: result.status,
    counts: { total: report.numTotalTests, passed: report.numPassedTests,
      failed: report.numFailedTests, skipped: report.numPendingTests },
    assertions: (suite?.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    routedToNative: output.includes(`Solid questionnaire browser route: ${nativeSource}`),
    nativeCaseEvidenceCount: output.match(/Native Solid case evidence:/g)?.length ?? 0,
    unhandledErrors: report.unhandledErrors ?? [],
    outputHasUnhandledErrors: output.includes('Unhandled Errors'),
    outputOnError: result.status ? output.slice(-4000) : undefined,
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react', 'tooling/parity/reference-shadcn-questionnaire-browser.config.ts');
  const solid = run('solid', 'tooling/parity/dual-shadcn-questionnaire-browser-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.total !== 23 || result.counts.passed !== 23 ||
        result.counts.failed !== 0 || result.counts.skipped !== 0 ||
        result.assertions.length !== 23 || result.unhandledErrors.length || result.outputHasUnhandledErrors)
      errors.push(`${mode} did not pass all 23 original Questionnaire browser assertions.`);
  }
  if (!solid.routedToNative || solid.nativeCaseEvidenceCount !== 23)
    errors.push('The unchanged browser test did not execute native Solid Questionnaire in all 23 cases.');
  const identities = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid browser assertion identities or results differ.');
  const evidence = { success: errors.length === 0, originalTest, react, solid,
    inputHashBefore: before.digest, inputHashAfter: after.digest, errors };
  writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ success: evidence.success, react: react.counts, solid: solid.counts,
    nativeRoute: solid.routedToNative && solid.nativeCaseEvidenceCount === 23,
    sourceHashStable: before.digest === after.digest,
    failedNames: solid.assertions.filter((item) => item.status === 'failed').map((item) => item.fullName),
    errors, artifact: relative(root, reportPath) }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
