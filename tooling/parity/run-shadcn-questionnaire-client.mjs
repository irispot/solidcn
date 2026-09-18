import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { parityInputHashes } from './input-hashes.mjs';

const root = resolve(import.meta.dirname, '../..');
const originalTest = 'shadcn-ui/packages/react/src/questionnaire/questionnaire.test.tsx';
const nativeSource = resolve(root, 'shadcn-ui/packages/solid/src/internal/questionnaire.tsx');
const reportPath = resolve(root, 'artifacts/unchanged-shadcn-questionnaire-client-comparison.json');
const temporary = mkdtempSync(resolve(tmpdir(), 'solid-cn-questionnaire-client-'));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8',
  });
  if (result.status !== 0) errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const outputPath = resolve(temporary, `${mode}.json`);
  const args = [
    'run', '--config', config, originalTest,
    '--reporter=default', '--reporter=json', `--outputFile=${outputPath}`,
  ];
  const result = spawnSync(resolve(root, 'node_modules/.bin/vitest'), args, {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  let report;
  try {
    report = JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch {
    report = { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0 };
    errors.push(`${mode} produced no JSON report (exit ${result.status}).`);
  }
  const suite = report.testResults?.[0];
  if (report.testResults?.length !== 1 || relative(root, suite.name) !== originalTest)
    errors.push(`${mode} did not load the exact unchanged Questionnaire client test.`);
  return {
    exitCode: result.status,
    counts: {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      skipped: report.numPendingTests,
    },
    assertions: (suite?.assertionResults ?? []).map((item) => ({
      fullName: item.fullName,
      status: item.status,
      error: item.status === 'failed' ? item.failureMessages?.[0]?.split('\n')[0] : undefined,
    })),
    routedToNative: output.includes(`Solid questionnaire route: ${nativeSource}`),
    nativeCaseEvidenceCount: output.match(/Native Solid case evidence:/g)?.length ?? 0,
    outputOnError: result.status ? output.slice(-4000) : undefined,
  };
}

try {
  guard('Before');
  const before = parityInputHashes();
  const react = run('react', 'tooling/parity/shadcn-react-reference.config.ts');
  const solid = run('solid', 'tooling/parity/dual-shadcn-questionnaire-client-solid.config.ts');
  const after = parityInputHashes();
  guard('After');
  if (before.digest !== after.digest) errors.push('Source or runner inputs changed during the run.');
  for (const [mode, result] of [['React', react], ['Solid', solid]]) {
    if (result.exitCode !== 0 || result.counts.passed !== 53 || result.counts.failed !== 0 ||
        result.counts.skipped !== 0 || result.counts.total !== 53)
      errors.push(`${mode} did not pass all 53 original Questionnaire client assertions.`);
  }
  if (!solid.routedToNative || solid.nativeCaseEvidenceCount !== 53)
    errors.push('The unchanged test did not execute the native Solid Questionnaire in all 53 cases.');
  const identities = (result) => result.assertions.map((item) => `${item.fullName}\u0000${item.status}`).sort();
  if (JSON.stringify(identities(react)) !== JSON.stringify(identities(solid)))
    errors.push('React and Solid assertion identities or results differ.');
  const evidence = {
    success: errors.length === 0,
    originalTest,
    selectedGroup: 'Questionnaire',
    react,
    solid,
    inputHashBefore: before.digest,
    inputHashAfter: after.digest,
    errors,
  };
  writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    react: react.counts,
    solid: solid.counts,
    nativeRoute: solid.routedToNative && solid.nativeCaseEvidenceCount === 53,
    sourceHashStable: before.digest === after.digest,
    failedNames: solid.assertions.filter((item) => item.status === 'failed').map((item) => item.fullName),
    errors,
    artifact: relative(root, reportPath),
  }, null, 2));
  if (!evidence.success) process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
