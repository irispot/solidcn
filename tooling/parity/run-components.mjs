import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const artifacts = resolve(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
const sourceFiles = [
  "base-ui/packages/solid/src/core.tsx",
  "base-ui/packages/solid/src/controls.tsx",
  "base-ui/packages/solid/src/structure.tsx",
  "base-ui/packages/solid/src/merge-props/mergeProps.ts",
  "tooling/parity/fixture-runtime.ts",
  "tooling/parity/fixture-renderer.ts",
  "tooling/parity/fixture-entry.ts",
  "tooling/parity/fixture-setup.ts",
  "tooling/parity/fieldset-route.ts",
  "tooling/parity/semantic-route.ts",
  "tooling/parity/button-route.ts",
  "tooling/parity/separator-route.ts",
  "tooling/parity/use-render-route.ts",
  "tooling/parity/components.config.ts",
  "tooling/parity/separator.config.ts",
  "tooling/parity/run-components.mjs",
  "package-lock.json",
];
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(resolve(root, file)))
        .digest("hex"),
    ]),
  );
const startedAt = new Date().toISOString();
const inputsBefore = hashes();
// A failed runner must not leave the prior successful report in place.
writeFileSync(
  resolve(artifacts, "unchanged-components-native-solid.json"),
  JSON.stringify({
    success: false,
    harnessError: "The current Vitest run has not produced a report.",
    testResults: [],
  }),
);
const args = [
  "vitest",
  "run",
  "--config",
  "tooling/parity/components.config.ts",
  "--reporter=default",
  "--reporter=json",
  "--outputFile=artifacts/unchanged-components-native-solid.json",
];
const result = spawnSync("npx", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
writeFileSync(
  resolve(artifacts, "unchanged-components-native-solid.log"),
  output,
);
const report = JSON.parse(
  readFileSync(
    resolve(artifacts, "unchanged-components-native-solid.json"),
    "utf8",
  ),
);
const nativeExecutions = {};
for (const match of output.matchAll(
  /Native Solid execution evidence: (\{[^\n]+\})/g,
)) {
  for (const [source, count] of Object.entries(JSON.parse(match[1])))
    nativeExecutions[source] = (nativeExecutions[source] ?? 0) + count;
}
const inputsAfter = hashes();
const harnessErrors = [];
if (JSON.stringify(inputsBefore) !== JSON.stringify(inputsAfter))
  harnessErrors.push("Native source or adapter inputs changed during the run.");
if (report.harnessError) harnessErrors.push(report.harnessError);
if (report.startTime < Date.parse(startedAt))
  harnessErrors.push("The Vitest report predates this run.");
const summary = {
  command: `npx ${args.join(" ")}`,
  generatedAt: new Date().toISOString(),
  startedAt,
  environment:
    "jsdom; Solid 2.0.0-rc.8 browser/development runtime; no React runtime",
  exitCode: result.status,
  passed: report.numPassedTests,
  failed: report.numFailedTests,
  skipped: report.numPendingTests,
  harnessErrors,
  nativeExecutions,
  diagnostics: {
    strictReadUntracked: (
      output.match(/\[STRICT_READ_UNTRACKED\] Reactive/g) ?? []
    ).length,
  },
  suites: report.testResults.map((suite) => ({
    file: suite.name.replace(`${root}/`, ""),
    passed: suite.assertionResults.filter((item) => item.status === "passed")
      .length,
    failed: suite.assertionResults.filter((item) => item.status === "failed")
      .length,
    skipped: suite.assertionResults
      .filter((item) => item.status === "pending" || item.status === "skipped")
      .map((item) => item.fullName),
  })),
  sha256: inputsAfter,
  inputsBefore,
  limits: [
    "Nineteen original files are selected: Button, Separator, useRender, both Fieldset parts, FieldDescription, Input, AvatarRoot, Toggle, and all Meter and Progress parts.",
    "Original isJSDOM skip conditions are retained, including Fieldset SSR and hydration cases.",
    "Fixture hooks have bounded semantics, not the full React lifecycle.",
    "Native same-type descriptors and unkeyed array children retain DOM; keyed arrays fail explicitly and hook-returned JSX functions can remount.",
    "Adding or removing prop keys on a retained fixture component is unsupported and throws.",
    "Strict-read diagnostics are retained in the log, not suppressed.",
  ],
};
writeFileSync(
  resolve(artifacts, "unchanged-components-native-solid-evidence.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 2));
if (result.error) console.error(result.error);
process.exitCode = harnessErrors.length ? 1 : (result.status ?? 1);
