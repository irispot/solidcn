import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toastPartFiles } from './toast-part-files.mjs';

const root = resolve(import.meta.dirname, '../..');
const native = 'base-ui/packages/solid/src/notifications.tsx';
const output = resolve(root, 'artifacts/unchanged-toast-parts-diagnostic.json');
const tracked = [...toastPartFiles, native];
const digest = (file) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const before = Object.fromEntries(tracked.map((file) => [file, digest(file)]));
const errors = [];
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) errors.push(`${stage} original-file guard failed.`);
}

function run(name, config) {
  const reportPath = resolve(root, `artifacts/unchanged-toast-parts-${name}.json`);
  const result = spawnSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', '--config', `tooling/parity/${config}`,
    '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, TZ: 'UTC' } });
  let report;
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); }
  catch {
    errors.push(`${name} did not write a test report: ${result.stderr?.slice(-800)}`);
    return null;
  }
  return {
    exitCode: result.status,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    nativeExecutionEvidence: (result.stdout ?? '').includes('Native Solid execution evidence:'),
    cases: report.testResults.flatMap((suite) => suite.assertionResults.map((item) => ({
      name: item.fullName,
      status: item.status,
      error: item.failureMessages?.[0]?.split('\n')[0],
    }))),
  };
}

guard('Before');
const react = run('react', 'reference-toast-parts-client.config.ts');
const solid = run('solid', 'dual-toast-parts-client-solid.config.ts');
guard('After');
const after = Object.fromEntries(tracked.map((file) => [file, digest(file)]));
for (const file of tracked)
  if (before[file] !== after[file]) errors.push(`Source changed during run: ${file}`);
if (react?.exitCode !== 0 || react?.failed) errors.push('The original React suite failed.');
if (!solid?.nativeExecutionEvidence) errors.push('Native Solid execution evidence is missing.');
const originalCases = new Map(react?.cases.map((item) => [item.name, item]) ?? []);
const solidCases = new Map(solid?.cases.map((item) => [item.name, item]) ?? []);
const missing = [...originalCases.keys()].filter((name) => !solidCases.has(name));
const extra = [...solidCases.keys()].filter((name) => !originalCases.has(name));
const skipMismatch = [...originalCases].filter(([name, item]) =>
  (item.status === 'pending') !== (solidCases.get(name)?.status === 'pending'),
).map(([name]) => name);
if (missing.length || extra.length || skipMismatch.length)
  errors.push('The two routes did not execute the same original case set and skips.');
const report = {
  diagnosticComplete: errors.length === 0,
  parityPassed: errors.length === 0 && solid?.failed === 0 && solid?.passed === react?.passed,
  scope: 'Ten unchanged upstream Toast part test files; not full Toast or migration acceptance.',
  originalTestSha256: Object.fromEntries(toastPartFiles.map((file) => [file, after[file]])),
  nativeSourceSha256: after[native],
  react: { passed: react?.passed, failed: react?.failed, skipped: react?.skipped },
  solid: { passed: solid?.passed, failed: solid?.failed, skipped: solid?.skipped },
  missing,
  extra,
  skipMismatch,
  failures: solid?.cases.filter((item) => item.status === 'failed') ?? [],
  errors,
};
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Toast parts: React ${react?.passed} passed/${react?.skipped} skipped; Solid ${solid?.passed} passed/${solid?.failed} failed/${solid?.skipped} skipped.`);
console.log(`Diagnostic: ${output}`);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}
