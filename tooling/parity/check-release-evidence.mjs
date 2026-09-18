import assert from "node:assert/strict";
import {
  RELEASE_ENVIRONMENTS,
  expectedSuites,
  releaseInputDigest,
  validateReleaseEvidence,
} from "./release-evidence.mjs";

// Synthetic reports only. Do not read, edit, or replace original test files.
const root = "/fixture";
const original = "base-ui/packages/react/src/button/Button.test.tsx";
const spec = "base-ui/packages/react/src/button/Button.spec.tsx";
const native = "base-ui/packages/solid/src/controls.tsx";
const sha = "a".repeat(64),
  otherSha = "b".repeat(64);
const startedAt = "2026-01-01T00:00:00.000Z";
const finishedAt = "2026-01-01T00:01:00.000Z";
const inputs = {
  [native]: sha,
  "artifacts/base.tgz": sha,
  "artifacts/styled.tgz": sha,
};
const stamp = {
  startedAt,
  finishedAt,
  runInputsSha256: releaseInputDigest(inputs),
};
const report = {
  success: true,
  numFailedTests: 0,
  numFailedTestSuites: 0,
  numTotalTests: 2,
  numPassedTests: 1,
  numPendingTests: 1,
  startTime: Date.parse(startedAt),
  testResults: [
    {
      name: `${root}/${original}`,
      status: "passed",
      assertionResults: [
        { fullName: "Button renders", status: "passed", failureMessages: [] },
        {
          fullName: "Button original skip",
          status: "skipped",
          failureMessages: [],
        },
      ],
    },
  ],
};
const cases = [];
function fixture() {
  const data = {};
  const put = (name, value) => {
    data[name] = structuredClone(value);
    return { path: `artifacts/${name}`, sha256: sha };
  };
  const evidence = {
    schemaVersion: 1,
    solidVersion: "2.0.0-rc.8",
    startedAt,
    finishedAt,
    inputsBefore: { ...inputs },
    inputsAfter: { ...inputs },
    runtime: {},
    archiveHashes: [
      { path: "artifacts/base.tgz", sha256: sha },
      { path: "artifacts/styled.tgz", sha256: sha },
    ],
  };
  for (const environment of RELEASE_ENVIRONMENTS)
    evidence.runtime[environment] = {
      reference: put(`${environment}-reference.json`, report),
      native: put(`${environment}-native.json`, report),
      routing: put(`${environment}-routing.json`, {
        ...stamp,
        referenceSha256: sha,
        nativeSha256: sha,
        originalImplementationFiles: [],
        reactRuntimeFiles: [],
        suites: { [original]: { nativeFiles: [native], nativeExecutions: 1 } },
      }),
    };
  const rows = [
    {
      module: "@solid-cn/base-ui",
      expected: [{ name: "Button", kind: "function" }],
      actual: [{ name: "Button", kind: "function" }],
    },
  ];
  evidence.api = put("api.json", { ...stamp, browser: rows, server: rows });
  evidence.types = put("types.json", {
    ...stamp,
    exitCode: 0,
    diagnostics: [],
    originalSpecs: [spec],
    mappings: [{ original: spec, assertions: 1, failed: 0, unsupported: 0 }],
  });
  const checks = [
    "isolated npm install",
    "consumer TypeScript",
    "native/styled Node SSR",
  ];
  for (const entry of ["source", "compiled"])
    checks.push(
      `${entry}: consumer Vite production build`,
      `${entry}: consumer Vite SSR build`,
      `${entry}: consumer Node SSR HTML`,
      `${entry}: packed production browser events, CSS, checkbox, and dialog`,
      `${entry}: SSR hydration node identity, events, CSS, checkbox, and dialog`,
    );
  evidence.packages = put("packages.json", {
    ...stamp,
    passed: true,
    archives: ["artifacts/base.tgz", "artifacts/styled.tgz"],
    checks,
  });
  return { data, evidence, currentInputs: { ...inputs } };
}
async function check(change = () => {}) {
  const item = fixture();
  change(item);
  return validateReleaseEvidence({
    root,
    ...item,
    suites: { runtime: [original], types: [spec] },
    apiModules: ["@solid-cn/base-ui"],
    now: Date.parse(finishedAt),
    readArtifact: async (reference) => {
      const name = reference?.path?.slice("artifacts/".length);
      if (!reference || reference.sha256 !== sha || !item.data[name])
        throw new Error("Missing or changed report.");
      return item.data[name];
    },
  });
}
assert.equal(
  (await check()).passed,
  true,
  "The complete synthetic fixture must pass.",
);
async function rejects(name, change, pattern) {
  const result = await check(change);
  assert.equal(result.passed, false, name);
  assert.match(result.failures.join("\n"), pattern, name);
  cases.push(name);
}
await rejects(
  "status flags alone cannot pass",
  (item) => {
    item.evidence = { migrationComplete: true, fullComponentParity: "passed" };
  },
  /schemaVersion/,
);
await rejects(
  "missing report",
  ({ data }) => {
    delete data["api.json"];
  },
  /Missing/,
);
await rejects(
  "changed report",
  ({ evidence }) => {
    evidence.api.sha256 = otherSha;
  },
  /changed/,
);
await rejects(
  "missing input",
  ({ evidence }) => {
    delete evidence.inputsBefore[native];
  },
  /inventory/,
);
await rejects(
  "stale source",
  ({ currentInputs }) => {
    currentInputs[native] = otherSha;
  },
  /stale input/,
);
await rejects(
  "source changed during run",
  ({ evidence }) => {
    evidence.inputsAfter[native] = otherSha;
  },
  /stale input/,
);
await rejects(
  "future report",
  ({ evidence }) => {
    evidence.finishedAt = "2099-01-01";
  },
  /timestamps/,
);
await rejects(
  "old report with new manifest",
  ({ data }) => {
    data["api.json"].runInputsSha256 = otherSha;
  },
  /not bound/,
);
await rejects(
  "old report interval",
  ({ data }) => {
    data["api.json"].startedAt = "2025-01-01";
  },
  /outside/,
);
await rejects(
  "missing browser run",
  ({ evidence }) => {
    delete evidence.runtime.webkit;
  },
  /Missing/,
);
await rejects(
  "missing suite",
  ({ data }) => {
    data["chromium-native.json"].testResults = [];
  },
  /inventory/,
);
await rejects(
  "missing case",
  ({ data }) => {
    data["chromium-native.json"].testResults[0].assertionResults.pop();
  },
  /identities/,
);
await rejects(
  "new skip",
  ({ data }) => {
    data["chromium-native.json"].testResults[0].assertionResults[0].status =
      "skipped";
  },
  /outcomes/,
);
await rejects(
  "todo case",
  ({ data }) => {
    data["chromium-native.json"].testResults[0].assertionResults[0].status =
      "todo";
  },
  /todo/,
);
await rejects(
  "failed runner",
  ({ data }) => {
    data["chromium-native.json"].success = false;
  },
  /runner/,
);
await rejects(
  "wrong counts",
  ({ data }) => {
    data["chromium-native.json"].numTotalTests = 900;
  },
  /totals/,
);
await rejects(
  "missing native route",
  ({ data }) => {
    data["chromium-routing.json"].suites[original].nativeFiles = [];
  },
  /no native/,
);
await rejects(
  "loaded but unused native module",
  ({ data }) => {
    data["chromium-routing.json"].suites[original].nativeExecutions = 0;
  },
  /execution evidence/,
);
await rejects(
  "React implementation route",
  ({ data }) => {
    data["chromium-routing.json"].originalImplementationFiles = ["original.ts"];
  },
  /original implementations/,
);
await rejects(
  "React runtime route",
  ({ data }) => {
    data["chromium-routing.json"].reactRuntimeFiles = ["react.js"];
  },
  /React runtime/,
);
await rejects(
  "unbound route report",
  ({ data }) => {
    data["chromium-routing.json"].nativeSha256 = otherSha;
  },
  /paired/,
);
await rejects(
  "missing API module",
  ({ data }) => {
    data["api.json"].browser = [];
  },
  /inventory/,
);
await rejects(
  "wrong API value kind",
  ({ data }) => {
    data["api.json"].browser[0].actual[0].kind = "number";
  },
  /wrong or missing/,
);
await rejects(
  "incomplete type coverage",
  ({ data }) => {
    data["types.json"].originalSpecs = [];
  },
  /type suites/,
);
await rejects(
  "unsupported type mapping",
  ({ data }) => {
    data["types.json"].mappings[0].unsupported = 1;
  },
  /incomplete/,
);
await rejects(
  "missing hydration check",
  ({ data }) => {
    data["packages.json"].checks.pop();
  },
  /consumer/,
);
await rejects(
  "changed archive",
  ({ evidence }) => {
    evidence.archiveHashes[0].sha256 = otherSha;
  },
  /archive digest/,
);
await rejects(
  "duplicate archives",
  ({ evidence }) => {
    evidence.archiveHashes[1] = { ...evidence.archiveHashes[0] };
  },
  /distinct/,
);
await rejects(
  "consumer errors with passed flag",
  ({ data }) => {
    data["packages.json"].diagnostics = [{ errors: ["Hydration mismatch"] }];
  },
  /error diagnostic/,
);
assert.deepEqual(
  expectedSuites({
    repositories: {
      "base-ui": {
        files: {
          "packages/react/src/A.test.tsx": {},
          "packages/react/src/A.spec.tsx": {},
          "docs/A.test.ts": {},
          "packages/react/test/helper.ts": {},
        },
      },
    },
  }),
  {
    runtime: ["base-ui/packages/react/src/A.test.tsx"],
    types: ["base-ui/packages/react/src/A.spec.tsx"],
  },
);
console.log(
  JSON.stringify(
    {
      passed: true,
      syntheticRejectionChecks: cases.length,
      checks: cases,
      originalTestsReadOrChanged: false,
      behaviorAcceptance: false,
    },
    null,
    2,
  ),
);
