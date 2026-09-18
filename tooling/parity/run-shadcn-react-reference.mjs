import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const deps = resolve(root, 'tooling/parity/shadcn-browser-deps');
const artifacts = resolve(root, 'artifacts');
const jsdomReport = resolve(artifacts, 'shadcn-react-reference-jsdom.json');
const browserReport = resolve(artifacts, 'shadcn-react-reference-browser.json');

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function result(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  return {
    files: report.testResults.length,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    suitesFailed: report.testResults.filter((entry) => entry.status !== 'passed').length,
    names: report.testResults.map((entry) => entry.name.slice(root.length + 1)).sort(),
  };
}

mkdirSync(artifacts, { recursive: true });
run(process.execPath, ['tooling/parity/preserve.mjs', 'verify']);

if (!existsSync(resolve(deps, 'node_modules/@vitest/browser-playwright/package.json'))) {
  run('npm', ['ci', '--prefix', deps, '--ignore-scripts', '--no-audit', '--no-fund']);
}
run(process.execPath, [resolve(deps, 'node_modules/playwright/cli.js'), 'install', 'chromium']);

run(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run',
  '--config', 'tooling/parity/shadcn-react-reference.config.ts',
  '--reporter=json', '--outputFile=' + jsdomReport,
]);
run(process.execPath, [
  resolve(deps, 'node_modules/vitest/vitest.mjs'), 'run',
  '--config', 'tooling/parity/shadcn-browser-deps/reference.config.ts',
  '--reporter=json', '--outputFile=' + browserReport,
]);

const summary = { jsdom: result(jsdomReport), chromium: result(browserReport) };
summary.passed = summary.jsdom.files === 4 && summary.chromium.files === 3 &&
  summary.jsdom.failed === 0 && summary.chromium.failed === 0 &&
  summary.jsdom.suitesFailed === 0 && summary.chromium.suitesFailed === 0;
writeFileSync(resolve(artifacts, 'shadcn-react-reference-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
