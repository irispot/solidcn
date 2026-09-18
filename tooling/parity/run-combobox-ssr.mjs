import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import {
  comboboxSsrAssertions,
  comboboxSsrTestFile,
} from "./combobox-ssr-selected.mjs";
import { parityInputHashes } from "./input-hashes.mjs";
import { selectedSsrFixtureModules, unexpectedOriginalReactModules } from "./original-react-module-policy.mjs";

const root = resolve(import.meta.dirname, "../..");
const testPath = resolve(root, comboboxSsrTestFile);
const temp = mkdtempSync(resolve(tmpdir(), "solid-cn-combobox-ssr-"));
const artifactPath = resolve(root, 'artifacts/unchanged-combobox-ssr-comparison.json');
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(artifactPath, JSON.stringify({ success: false, errors: ['Run did not complete.'] }));
const errors = [];
const inputsBefore = parityInputHashes();
const sourceHash = () =>
  createHash("sha256").update(readFileSync(testPath)).digest("hex");
const beforeHash = sourceHash();

function verifyOriginalFiles(stage) {
  const result = spawnSync(
    process.execPath,
    ["tooling/parity/preserve.mjs", "verify"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) {
    errors.push(
      `${stage} original-file guard failed: ${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

function run(mode, config) {
  const reportPath = resolve(temp, `${mode}.json`);
  const command = resolve(root, "node_modules/.bin/vitest");
  const result = spawnSync(
    command,
    [
      "run",
      "--config",
      config,
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    report = { success: false, testResults: [] };
  }
  const sourceModules = [
    ...output.matchAll(/Parity source loaded: (\{[^\n]+\})/g),
  ]
    .map((match) => JSON.parse(match[1]))
    .filter((item) => item.mode === mode)
    .map((item) => item.file);
  const nativeExecutions = Object.fromEntries(
    [
      ...output.matchAll(/Native Solid execution evidence: (\{[^\n]+\})/g),
    ].flatMap((match) => Object.entries(JSON.parse(match[1]))),
  );
  const nativeCaseExecutions = [
    ...output.matchAll(/Native Solid case evidence: (\{[^\n]+\})/g),
  ].map((match) => JSON.parse(match[1]));
  if (result.status !== 0 || report.success !== true) {
    errors.push(
      `${mode} runner failed (exit ${result.status ?? "unknown"}).\n${output.slice(-7000)}`,
    );
  }
  const suites = report.testResults ?? [];
  if (
    suites.length !== 1 ||
    relative(root, suites[0]?.name ?? "") !== comboboxSsrTestFile
  ) {
    errors.push(`${mode} did not report the one selected original test file.`);
  }
  const assertions = suites[0]?.assertionResults ?? [];
  const selected = assertions.filter(
    (item) => item.status === "passed" || item.status === "failed",
  );
  const filtered = assertions.filter(
    (item) => item.status === "pending" || item.status === "skipped",
  );
  if (
    selected.length !== comboboxSsrAssertions.length ||
    filtered.length !== 351 ||
    assertions.length !== 354 ||
    report.numFailedTests !== 0 ||
    report.numPassedTests !== 3 ||
    report.numPendingTests !== 351
  ) {
    errors.push(
      `${mode} selected/filtered count differs from 3 selected and 351 filtered.`,
    );
  }
  const rows = selected
    .map(({ fullName, status }) => ({ fullName, status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const allRows = assertions
    .map(({ fullName, status }) => ({ fullName, status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.status.localeCompare(b.status));
  for (const name of comboboxSsrAssertions) {
    const matching = rows.filter((item) => item.fullName.endsWith(name));
    if (
      matching.length !== 1 ||
      matching[0].status !== "passed" ||
      !matching[0].fullName.includes("server-side rendering")
    ) {
      errors.push(`${mode} did not pass the exact original assertion: ${name}`);
    }
  }
  return {
    config,
    counts: {
      total: assertions.length,
      passed: report.numPassedTests,
      filtered: filtered.length,
    },
    rows,
    allRows,
    sourceModules,
    nativeExecutions,
    nativeCaseExecutions,
  };
}

try {
  verifyOriginalFiles("Before");
  const react = run("react", "tooling/parity/reference-combobox-ssr.config.ts");
  const solid = run(
    "solid",
    "tooling/parity/dual-combobox-ssr-solid.config.ts",
  );
  if (JSON.stringify(react.rows) !== JSON.stringify(solid.rows)) {
    errors.push("React and Solid fullName/status rows differ.");
  }
  if (JSON.stringify(react.allRows) !== JSON.stringify(solid.allRows)) {
    errors.push('React and Solid full assertion inventories differ, including filtered rows.');
  }
  if (
    !react.sourceModules.includes(
      "base-ui/packages/react/src/combobox/root/ComboboxRoot.tsx",
    ) ||
    react.sourceModules.some((file) =>
      file.startsWith("base-ui/packages/solid/src/"),
    )
  ) {
    errors.push(
      "The React run did not use only the original React component source.",
    );
  }
  const unexpectedOriginal = unexpectedOriginalReactModules(
    solid.sourceModules, selectedSsrFixtureModules.combobox);
  if (!solid.sourceModules.includes("base-ui/packages/solid/src/selection.tsx") ||
      unexpectedOriginal.length) {
    errors.push(
      `The Solid run loaded unexpected original React source or missed native selection: ${unexpectedOriginal.join(', ')}`,
    );
  }
  if (
    (solid.nativeExecutions[
      "base-ui/packages/solid/src/selection.tsx#Combobox.Root"
    ] ?? 0) !== 3
  ) {
    errors.push(
      "The three Solid cases did not each execute the native Combobox.Root.",
    );
  }
  const requiredParts = [
    ['Combobox.Root', 'Combobox.Input'],
    ['Combobox.Root', 'Combobox.Trigger'],
    ['Combobox.Root', 'Combobox.Label', 'Combobox.Trigger', 'Combobox.Input'],
  ];
  for (let index = 0; index < comboboxSsrAssertions.length; index++) {
    const cases = solid.nativeCaseExecutions.filter((row) =>
      row.fullName?.endsWith(comboboxSsrAssertions[index]) &&
      relative(root, row.testPath) === comboboxSsrTestFile);
    if (cases.length !== 1 || requiredParts[index].some((part) =>
      !(cases[0].nativeExecutions?.[`base-ui/packages/solid/src/selection.tsx#${part}`] > 0))) {
      errors.push(`The Solid SSR case did not execute its native parts: ${comboboxSsrAssertions[index]}`);
    }
  }
  const afterHash = sourceHash();
  const inputsAfter = parityInputHashes();
  verifyOriginalFiles("After");
  if (beforeHash !== afterHash)
    errors.push("The original test file changed during verification.");
  if (inputsBefore.digest !== inputsAfter.digest)
    errors.push('Source, dependency, or parity runner inputs changed during verification.');
  const evidence = {
        success: errors.length === 0,
        originalTestFile: comboboxSsrTestFile,
        originalTestSha256: afterHash,
        react: {
          config: react.config,
          counts: react.counts,
          sourceRoute: "original React ComboboxRoot.tsx",
        },
        solid: {
          config: solid.config,
          counts: solid.counts,
          sourceRoute: "native Solid selection.tsx",
          nativeExecutions: solid.nativeExecutions,
        },
        assertions: react.rows.map((row) => ({
          ...row,
          solidStatus:
            solid.rows.find((item) => item.fullName === row.fullName)?.status ??
            "missing",
        })),
        allAssertionRowsMatch: JSON.stringify(react.allRows) === JSON.stringify(solid.allRows),
        inputsBefore,
        inputsAfter,
        errors,
  };
  writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    success: evidence.success,
    originalTestFile: comboboxSsrTestFile,
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
