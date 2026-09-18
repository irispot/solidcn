import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dependencies = resolve(import.meta.dirname, 'reference-deps/node_modules');
const report = resolve(root, 'artifacts/unchanged-all-react-reference.json');
const previousReportTime = existsSync(report) ? statSync(report).mtimeMs : 0;

if (!existsSync(resolve(dependencies, 'vitest-browser-react'))) {
  throw new Error(
    'Install the isolated test dependencies first: npm ci --prefix tooling/parity/reference-deps --ignore-scripts --legacy-peer-deps',
  );
}

const prepare = spawnSync(process.execPath, [resolve(import.meta.dirname, 'prepare-reference.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (prepare.status !== 0) process.exit(prepare.status ?? 1);

const run = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    resolve(import.meta.dirname, 'reference-all.config.ts'),
    '--reporter=json',
    `--outputFile=${report}`,
  ],
  {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (!existsSync(report) || statSync(report).mtimeMs <= previousReportTime) {
  process.stderr.write(run.stderr || run.stdout || 'No React test report was written.\n');
  process.exit(run.status ?? 1);
}

const result = JSON.parse(readFileSync(report, 'utf8'));
const failed = result.testResults
  .filter((file) => file.status === 'failed')
  .map((file) => ({
    file: file.name.replace(`${root}/`, ''),
    tests: file.assertionResults
      .filter((test) => test.status === 'failed')
      .map((test) => test.fullName),
    loadError: file.message || undefined,
  }));
console.log(
  JSON.stringify(
    {
      report,
      files: result.testResults.length,
      tests: result.numTotalTests,
      passed: result.numPassedTests,
      failed: result.numFailedTests,
      skipped: result.numPendingTests,
      todo: result.numTodoTests,
      failedFiles: failed,
    },
    null,
    2,
  ),
);
if (run.error) throw run.error;
process.exit(run.status ?? 1);
