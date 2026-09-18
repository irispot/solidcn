import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { selectSsrTestFile, selectSsrTestName } from "./select-ssr-selected.mjs";
import { parityInputHashes } from './input-hashes.mjs';
import { selectedSsrFixtureModules, unexpectedOriginalReactModules } from './original-react-module-policy.mjs';

const root = resolve(import.meta.dirname, "../..");
const temp = mkdtempSync(resolve(tmpdir(), "solid-cn-select-ssr-"));
const artifactPath = resolve(root, 'artifacts/unchanged-select-ssr-comparison.json');
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(artifactPath, JSON.stringify({ success: false, errors: ['Run did not complete.'] }));
const inputsBefore = parityInputHashes();
const testPath = resolve(root, selectSsrTestFile);
const sourceHash = () =>
  createHash("sha256").update(readFileSync(testPath)).digest("hex");
const beforeHash = sourceHash();
const errors = [];

function guard(stage) {
  const result = spawnSync(
    process.execPath,
    ["tooling/parity/preserve.mjs", "verify"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0)
    errors.push(`${stage} original-file guard failed: ${result.stdout}${result.stderr}`);
}

function run(mode, config) {
  const reportPath = resolve(temp, `${mode}.json`);
  const result = spawnSync(
    resolve(root, "node_modules/.bin/vitest"),
    ["run", "--config", config, "--reporter=default", "--reporter=json", `--outputFile=${reportPath}`],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    report = { success: false, testResults: [] };
  }
  if (result.status !== 0 || report.success !== true)
    errors.push(`${mode} runner failed (exit ${result.status}).\n${output.slice(-4000)}`);
  const suites = report.testResults ?? [];
  if (suites.length !== 1 || relative(root, suites[0]?.name ?? "") !== selectSsrTestFile)
    errors.push(`${mode} did not report the selected original test file.`);
  const assertions = suites[0]?.assertionResults ?? [];
  const selected = assertions.filter((item) => item.status === "passed" || item.status === "failed");
  const filtered = assertions.filter((item) => item.status === "pending" || item.status === "skipped");
  if (
    assertions.length !== 179 || selected.length !== 1 || filtered.length !== 178 ||
    report.numPassedTests !== 1 || report.numFailedTests !== 0 || report.numPendingTests !== 178 ||
    selected[0]?.status !== "passed" || !selected[0]?.fullName.endsWith(selectSsrTestName) ||
    !selected[0]?.fullName.includes("server-side rendering")
  ) errors.push(`${mode} did not pass the one original SSR assertion with 178 filtered cases.`);
  const sourceModules = [...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === mode)
    .map((item) => item.file);
  const nativeExecutions = Object.fromEntries(
    [...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g)]
      .flatMap((match) => Object.entries(JSON.parse(match[1]))),
  );
  const nativeCaseExecutions = [...output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g)]
    .map((match) => JSON.parse(match[1]));
  const allRows = assertions.map(({ fullName, status }) => ({ fullName, status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.status.localeCompare(b.status));
  return {
    config,
    counts: { total: assertions.length, passed: report.numPassedTests, filtered: filtered.length },
    row: selected[0] ? { fullName: selected[0].fullName, status: selected[0].status } : null,
    allRows,
    sourceModules,
    nativeExecutions,
    nativeCaseExecutions,
  };
}

try {
  guard("Before");
  const react = run("react", "tooling/parity/reference-select-ssr.config.ts");
  const solid = run("solid", "tooling/parity/dual-select-ssr-solid.config.ts");
  if (JSON.stringify(react.row) !== JSON.stringify(solid.row))
    errors.push("React and Solid fullName/status rows differ.");
  if (JSON.stringify(react.allRows) !== JSON.stringify(solid.allRows))
    errors.push('React and Solid full assertion inventories differ, including filtered rows.');
  if (
    !react.sourceModules.includes("base-ui/packages/react/src/select/root/SelectRoot.tsx") ||
    react.sourceModules.some((file) => file.startsWith("base-ui/packages/solid/src/"))
  ) errors.push("React did not use the original Select implementation route.");
  const unexpectedOriginal = unexpectedOriginalReactModules(
    solid.sourceModules, selectedSsrFixtureModules.select);
  if (!solid.sourceModules.includes("base-ui/packages/solid/src/selection.tsx") ||
      unexpectedOriginal.length)
    errors.push(`Solid loaded unexpected original React source or missed native selection: ${unexpectedOriginal.join(', ')}`);
  if (solid.nativeExecutions["base-ui/packages/solid/src/selection.tsx#Select.Root"] !== 1)
    errors.push("The Solid case did not execute native Select.Root once.");
  const selectCases = solid.nativeCaseExecutions.filter((row) =>
    relative(root, row.testPath) === selectSsrTestFile &&
    row.fullName.endsWith(selectSsrTestName));
  if (selectCases.length !== 1 ||
      ['Select.Root', 'Select.Label', 'Select.Trigger', 'Select.Value'].some((part) =>
        !(selectCases[0].nativeExecutions?.[`base-ui/packages/solid/src/selection.tsx#${part}`] > 0)))
    errors.push('The selected Solid SSR case did not execute its native Select parts.');
  const afterHash = sourceHash();
  const inputsAfter = parityInputHashes();
  guard("After");
  if (beforeHash !== afterHash) errors.push("The original test file changed during verification.");
  if (inputsBefore.digest !== inputsAfter.digest)
    errors.push('Source, dependency, or parity runner inputs changed during verification.');
  const evidence = {
    success: errors.length === 0,
    originalTestFile: selectSsrTestFile,
    originalTestSha256: afterHash,
    react: { config: react.config, counts: react.counts, sourceRoute: "original React SelectRoot.tsx" },
    solid: {
      config: solid.config, counts: solid.counts,
      sourceRoute: "native Solid selection.tsx",
      nativeExecutions: solid.nativeExecutions,
    },
    assertion: { react: react.row, solid: solid.row },
    allAssertionRowsMatch: JSON.stringify(react.allRows) === JSON.stringify(solid.allRows),
    inputsBefore,
    inputsAfter,
    errors,
  };
  writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    originalTestFile: selectSsrTestFile,
    react: react.counts,
    solid: solid.counts,
    allAssertionRowsMatch: evidence.allAssertionRowsMatch,
    sourceHashStable: inputsBefore.digest === inputsAfter.digest,
    errors,
    report: relative(root, artifactPath),
  }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
