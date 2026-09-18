import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const artifact = resolve(root, 'artifacts/unchanged-shadcn-message-scroller-comparison.json');
const testFile = resolve(root, 'shadcn-ui/packages/react/src/message-scroller/message-scroller.test.tsx');
const nativeFile = resolve(root, 'shadcn-ui/packages/solid/src/internal/message-scroller.tsx');
const routes = {
  react: 'dual-shadcn-message-scroller-react.config.ts',
  solidClient: 'dual-shadcn-message-scroller-client-solid.config.ts',
  solidHydration: 'dual-shadcn-message-scroller-hydration-solid.config.ts',
};
const errors = [];
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const before = { test: digest(testFile), native: digest(nativeFile) };
mkdirSync(resolve(root, 'artifacts'), { recursive: true });

function guard(stage) {
  const result = spawnSync(process.execPath, ['tooling/parity/preserve.mjs', 'verify'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(name, config) {
  const reportFile = resolve(root, `artifacts/unchanged-shadcn-message-scroller-${name}.json`);
  const result = spawnSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run',
    '--config', `tooling/parity/${config}`,
    '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TZ: 'UTC' } });
  let report;
  try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
  catch {
    errors.push(`${name} did not write a test report: ${result.stderr?.slice(-800)}`);
    return { exitCode: result.status, passed: 0, failed: 0, skipped: 0, assertions: [] };
  }
  const assertions = report.testResults.flatMap((suite) => suite.assertionResults.map((item) => ({
    name: item.fullName,
    status: item.status,
    error: item.failureMessages?.[0]?.split('\n')[0],
  })));
  if (result.status !== 0) errors.push(`${name} exited ${result.status}`);
  if (report.numFailedTests) errors.push(`${name} has ${report.numFailedTests} failed cases`);
  return {
    exitCode: result.status,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    assertions,
    nativeExecutionEvidence: (result.stdout ?? '').includes('Native Solid execution evidence:'),
    hydrationEvidenceCount: (result.stdout ?? '').match(/Native Solid hydration evidence:/g)?.length ?? 0,
  };
}

guard('Before');
const results = Object.fromEntries(Object.entries(routes).map(([name, config]) => [name, run(name, config)]));
guard('After');
const after = { test: digest(testFile), native: digest(nativeFile) };
if (before.test !== after.test) errors.push('The original test file changed during the run.');
if (before.native !== after.native) errors.push('The native source changed during the run.');
const byName = (route) => new Map(route.assertions.map((item) => [item.name, item]));
const react = byName(results.react);
const client = byName(results.solidClient);
const hydration = byName(results.solidHydration);
if (react.size !== 49) errors.push(`Expected 49 original cases, got ${react.size}.`);
for (const [name, original] of react) {
  if (original.status !== 'passed') errors.push(`React did not pass: ${name}`);
  const matches = [client.get(name), hydration.get(name)].filter((item) => item?.status === 'passed');
  if (matches.length !== 1) errors.push(`Expected one passing native Solid route for: ${name}`);
}
if (results.solidClient.passed !== 44 || results.solidHydration.passed !== 5)
  errors.push('The client and SSR/hydration case counts changed.');
if (!results.solidClient.nativeExecutionEvidence || !results.solidHydration.nativeExecutionEvidence)
  errors.push('Native Solid execution evidence is missing.');
if (results.solidHydration.hydrationEvidenceCount !== 2)
  errors.push('Expected two live Solid hydration cases.');
const output = {
  passed: errors.length === 0,
  scope: 'One unchanged upstream MessageScroller test file; not full migration acceptance.',
  originalTestSha256: after.test,
  nativeSourceSha256: after.native,
  results,
  errors,
};
writeFileSync(artifact, `${JSON.stringify(output, null, 2)}\n`);
console.log(`MessageScroller: React ${results.react.passed}/49, Solid client ${results.solidClient.passed}/44, Solid SSR/hydration ${results.solidHydration.passed}/5.`);
console.log(`Evidence: ${artifact}`);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}
