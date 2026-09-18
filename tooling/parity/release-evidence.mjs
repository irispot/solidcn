import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const RELEASE_ENVIRONMENTS = ["jsdom", "chromium", "firefox", "webkit"];
export const SOLID_VERSION = "2.0.0-rc.8";
const packages = ["base-ui/packages/solid", "shadcn-ui/packages/solid"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values) => [...values].sort();
export const releaseInputDigest = (inputs) =>
  digest(
    JSON.stringify(
      Object.fromEntries(
        sorted(Object.keys(inputs)).map((key) => [key, inputs[key]]),
      ),
    ),
  );

function localPath(root, name) {
  if (typeof name !== "string" || isAbsolute(name) || name.includes("\\"))
    throw new Error(`Invalid evidence path: ${String(name)}`);
  const absolute = resolve(root, name);
  if (relative(root, absolute).split(sep).includes(".."))
    throw new Error(`Evidence path leaves the workspace: ${name}`);
  return absolute;
}

async function walk(root, directory, result) {
  for (const entry of await readdir(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink())
      throw new Error(`Release input must not be a symlink: ${name}`);
    if (entry.isDirectory()) await walk(root, name, result);
    else if (entry.isFile()) result.push(name);
  }
}

/** Exact input and output inventory; this function does not write a baseline. */
export async function collectReleaseInputs(root) {
  const files = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tooling/build.mjs",
    "tooling/inventory.mjs",
    "tooling/verify-packages.mjs",
  ];
  for (const pkg of packages) {
    files.push(`${pkg}/package.json`);
    await walk(root, `${pkg}/src`, files);
    await walk(root, `${pkg}/dist`, files);
  }
  await walk(root, "tooling/parity", files);
  return Object.fromEntries(
    await Promise.all(
      sorted(files).map(async (name) => [
        name,
        digest(await readFile(resolve(root, name))),
      ]),
    ),
  );
}

/** Read file names and blob metadata only, not original test source. */
export function expectedSuites(manifest) {
  const runtime = [],
    types = [];
  for (const [repository, { files }] of Object.entries(manifest.repositories)) {
    for (const path of Object.keys(files)) {
      if (!path.startsWith("packages/react/")) continue;
      if (/\.test\.[cm]?[jt]sx?$/.test(path))
        runtime.push(`${repository}/${path}`);
      if (/\.spec\.[cm]?[jt]sx?$/.test(path))
        types.push(`${repository}/${path}`);
    }
  }
  return { runtime: sorted(runtime), types: sorted(types) };
}

export async function expectedApiModules(root) {
  const original = JSON.parse(
    await readFile(
      resolve(root, "base-ui/packages/react/package.json"),
      "utf8",
    ),
  );
  const modules = Object.keys(original.exports)
    .filter((entry) => !entry.startsWith("./internals/"))
    .map(
      (entry) =>
        `@solid-cn/base-ui${entry === "." ? "" : `/${entry.slice(2)}`}`,
    );
  const styled = new Set();
  for (const directory of ["bases/base/ui", "new-york-v4/ui"]) {
    for (const file of await readdir(
      resolve(root, "shadcn-ui/apps/v4/registry", directory),
    ))
      if (file.endsWith(".tsx"))
        styled.add(`@solid-cn/ui/${file.slice(0, -4)}`);
  }
  return sorted([...modules, "@solid-cn/ui", ...styled]);
}

export async function readEvidenceArtifact(root, reference) {
  if (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? ""))
    throw new Error("A report reference needs a path and a SHA256 digest.");
  const path = localPath(root, reference.path);
  if (!reference.path.startsWith("artifacts/"))
    throw new Error("Reports must be below artifacts/.");
  if (!(await lstat(path)).isFile())
    throw new Error(`Not a report file: ${reference.path}`);
  const bytes = await readFile(path);
  if (digest(bytes) !== reference.sha256)
    throw new Error(`Report digest changed: ${reference.path}`);
  return JSON.parse(bytes.toString("utf8"));
}

function sourceInventory(value, current, fail, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label}: source inventory is missing.`);
    return;
  }
  if (!same(sorted(Object.keys(value)), sorted(Object.keys(current))))
    fail(`${label}: source inventory has missing or extra files.`);
  const changed = Object.keys(current).filter(
    (path) => value[path] !== current[path],
  );
  if (changed.length)
    fail(`${label}: ${changed.length} stale input(s); first: ${changed[0]}.`);
}

function suiteName(root, path) {
  if (typeof path !== "string")
    throw new Error("A suite result has no file name.");
  return isAbsolute(path) ? relative(root, path).split(sep).join("/") : path;
}

function testReport(root, report, fail, label) {
  const suites = new Map();
  if (
    report?.success !== true ||
    report.numFailedTests !== 0 ||
    report.numFailedTestSuites !== 0
  )
    fail(`${label}: runner did not pass.`);
  if (report?.numRuntimeErrorTestSuites > 0 || report?.unhandledErrors?.length)
    fail(`${label}: runner has unhandled errors.`);
  let total = 0,
    passed = 0,
    skipped = 0;
  for (const suite of report?.testResults ?? []) {
    const name = suiteName(root, suite.name);
    if (suites.has(name)) fail(`${label}: duplicate suite ${name}.`);
    const rows = suite.assertionResults;
    if (!Array.isArray(rows) || rows.length === 0) {
      fail(`${label}: suite has no assertion results: ${name}.`);
      continue;
    }
    if (!["passed", "pending", "skipped"].includes(suite.status))
      fail(`${label}: failed suite ${name}.`);
    const cases = [];
    for (const row of rows) {
      if (typeof row.fullName !== "string" || !row.fullName)
        fail(`${label}: an assertion has no identity in ${name}.`);
      const status = row.status === "pending" ? "skipped" : row.status;
      if (
        !["passed", "skipped"].includes(status) ||
        row.failureMessages?.length
      )
        fail(`${label}: failed, todo, or unknown assertion in ${name}.`);
      total++;
      passed += status === "passed" ? 1 : 0;
      skipped += status === "skipped" ? 1 : 0;
      cases.push({ name: row.fullName, status });
    }
    suites.set(
      name,
      cases.sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.status.localeCompare(b.status),
      ),
    );
  }
  if (!total || !passed) fail(`${label}: no passing assertions.`);
  if (
    report?.numTotalTests !== total ||
    report.numPassedTests !== passed ||
    report.numPendingTests !== skipped
  )
    fail(`${label}: assertion totals do not match the report body.`);
  return suites;
}

/** Pure fail-closed validation. readArtifact can be replaced only by diagnostics. */
export async function validateReleaseEvidence({
  root,
  evidence,
  currentInputs,
  suites,
  apiModules,
  readArtifact,
  now = Date.now(),
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const load = async (reference, label) => {
    try {
      return await readArtifact(reference);
    } catch (error) {
      fail(`${label}: ${error.message}`);
      return null;
    }
  };
  if (evidence?.schemaVersion !== 1)
    fail("Release evidence schemaVersion must be 1.");
  if (evidence?.solidVersion !== SOLID_VERSION)
    fail(`Release needs Solid ${SOLID_VERSION}.`);
  const start = Date.parse(evidence?.startedAt),
    end = Date.parse(evidence?.finishedAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    end > now + 60_000
  )
    fail("Release evidence timestamps are missing or invalid.");
  sourceInventory(evidence?.inputsBefore, currentInputs, fail, "Before run");
  sourceInventory(evidence?.inputsAfter, currentInputs, fail, "After run");
  const fresh = (report, label) => {
    if (report?.runInputsSha256 !== releaseInputDigest(currentInputs))
      fail(`${label}: report is not bound to the current release inputs.`);
    const began = Date.parse(report?.startedAt),
      ended = Date.parse(report?.finishedAt);
    if (
      !Number.isFinite(began) ||
      !Number.isFinite(ended) ||
      began < start ||
      ended > end ||
      began > ended
    )
      fail(`${label}: report run is outside the release evidence interval.`);
  };
  const loaded = new Set();
  for (const environment of RELEASE_ENVIRONMENTS) {
    const run = evidence?.runtime?.[environment];
    const reference = await load(
      run?.reference,
      `${environment} original report`,
    );
    const native = await load(run?.native, `${environment} Solid report`);
    const routing = await load(run?.routing, `${environment} routing report`);
    if (!reference || !native || !routing) continue;
    fresh(routing, `${environment} routing`);
    if (
      routing.referenceSha256 !== run.reference.sha256 ||
      routing.nativeSha256 !== run.native.sha256
    )
      fail(
        `${environment}: routing evidence is not bound to the paired test reports.`,
      );
    for (const [label, report] of [
      ["original", reference],
      ["Solid", native],
    ]) {
      if (
        !Number.isFinite(report.startTime) ||
        report.startTime < start ||
        report.startTime > end
      )
        fail(
          `${environment} ${label}: test report start time is outside the evidence interval.`,
        );
    }
    const before = testReport(root, reference, fail, `${environment} original`);
    const after = testReport(root, native, fail, `${environment} Solid`);
    for (const [label, map] of [
      ["original", before],
      ["Solid", after],
    ]) {
      if (!same(sorted(map.keys()), suites.runtime))
        fail(
          `${environment} ${label}: full original runtime suite inventory is not covered.`,
        );
    }
    for (const name of suites.runtime) {
      if (!same(before.get(name), after.get(name)))
        fail(
          `${environment}: assertion identities, outcomes, or original skips differ: ${name}.`,
        );
    }
    if (
      !Array.isArray(routing.originalImplementationFiles) ||
      routing.originalImplementationFiles.length
    )
      fail(
        `${environment}: native route audit is missing or loads original implementations.`,
      );
    if (
      !Array.isArray(routing.reactRuntimeFiles) ||
      routing.reactRuntimeFiles.length
    )
      fail(
        `${environment}: native route audit is missing or loads the React runtime.`,
      );
    if (!same(sorted(Object.keys(routing.suites ?? {})), suites.runtime))
      fail(
        `${environment}: routing coverage differs from the full runtime suite inventory.`,
      );
    for (const [name, item] of Object.entries(routing.suites ?? {})) {
      if (!Array.isArray(item.nativeFiles) || item.nativeFiles.length === 0)
        fail(`${environment}: no native implementation evidence for ${name}.`);
      if (!Number.isInteger(item.nativeExecutions) || item.nativeExecutions < 1)
        fail(
          `${environment}: no native function execution evidence for ${name}.`,
        );
      for (const path of item.nativeFiles ?? []) {
        if (
          !packages.some((pkg) => path.startsWith(`${pkg}/src/`)) ||
          !currentInputs[path]
        )
          fail(`${environment}: invalid native implementation route ${path}.`);
      }
    }
    loaded.add(environment);
  }
  const api = await load(evidence?.api, "Public API report");
  if (api) {
    fresh(api, "Public API");
    for (const environment of ["browser", "server"]) {
      const rows = api[environment];
      if (
        !Array.isArray(rows) ||
        !same(sorted(rows.map((row) => row.module)), apiModules)
      ) {
        fail(
          `Public API ${environment}: root and public subpath inventory is incomplete.`,
        );
        continue;
      }
      for (const row of rows) {
        const typeOnly = row.module === "@solid-cn/base-ui/types";
        if (
          !Array.isArray(row.expected) ||
          !Array.isArray(row.actual) ||
          (!typeOnly && !row.expected.length) ||
          (typeOnly && (row.expected.length || row.actual.length))
        ) {
          fail(
            `Public API ${environment}: missing export shapes for ${row.module}.`,
          );
          continue;
        }
        const actual = new Map(
          row.actual.map((item) => [item.name, item.kind]),
        );
        for (const item of row.expected) {
          if (!item.name || !item.kind || actual.get(item.name) !== item.kind)
            fail(
              `Public API ${environment}: wrong or missing export ${row.module}#${item.name}.`,
            );
        }
      }
    }
  }
  const types = await load(evidence?.types, "Public type report");
  if (types) {
    fresh(types, "Public types");
    if (types.exitCode !== 0 || types.diagnostics?.length !== 0)
      fail("Public type assertions did not pass with zero diagnostics.");
    if (
      !Array.isArray(types.originalSpecs) ||
      !same(sorted(types.originalSpecs), suites.types)
    )
      fail(
        "Public type evidence does not cover all pinned original type suites.",
      );
    if (
      !Array.isArray(types.mappings) ||
      !same(sorted(types.mappings.map((item) => item.original)), suites.types)
    )
      fail("Public type evidence lacks explicit React-to-Solid type mappings.");
    for (const item of types.mappings ?? []) {
      if (
        !Number.isInteger(item.assertions) ||
        item.assertions < 1 ||
        item.failed !== 0 ||
        item.unsupported !== 0
      )
        fail(`Public type assertions are incomplete for ${item.original}.`);
    }
  }
  const packed = await load(evidence?.packages, "Packed consumer report");
  if (packed) {
    fresh(packed, "Packed consumer");
    const required = [
      "isolated npm install",
      "consumer TypeScript",
      "native/styled Node SSR",
    ];
    for (const entry of ["source", "compiled"])
      required.push(
        `${entry}: consumer Vite production build`,
        `${entry}: consumer Vite SSR build`,
        `${entry}: consumer Node SSR HTML`,
        `${entry}: packed production browser events, CSS, checkbox, and dialog`,
        `${entry}: SSR hydration node identity, events, CSS, checkbox, and dialog`,
      );
    if (
      packed.passed !== true ||
      required.some((check) => !packed.checks?.includes(check))
    )
      fail("Packed consumer evidence is incomplete or failed.");
    if (packed.diagnostics?.some((item) => item.failure || item.errors?.length))
      fail("Packed consumer report contains an error diagnostic.");
    if (
      !Array.isArray(evidence.archiveHashes) ||
      evidence.archiveHashes.length !== packages.length
    )
      fail("Packed archive digests are missing.");
    else
      for (const archive of evidence.archiveHashes) {
        if (
          !packed.archives?.some(
            (path) => suiteName(root, path) === archive.path,
          )
        )
          fail(
            `Packed archive is not in the consumer report: ${archive.path}.`,
          );
        // Archives are binary. The caller supplies their current digest separately.
        if (currentInputs[archive.path] !== archive.sha256)
          fail(`Packed archive digest is stale or absent: ${archive.path}.`);
      }
    if (
      !Array.isArray(packed.archives) ||
      packed.archives.length !== packages.length ||
      new Set(packed.archives.map((path) => suiteName(root, path))).size !==
        packages.length ||
      new Set((evidence.archiveHashes ?? []).map((item) => item.path)).size !==
        packages.length
    )
      fail("Packed consumer needs two distinct package archives.");
  }
  return {
    passed: failures.length === 0,
    failures,
    expectedRuntimeFiles: suites.runtime.length,
    expectedTypeFiles: suites.types.length,
    completeEnvironments: [...loaded],
    note: "This checks recorded evidence and live hashes. It does not generate missing parity evidence.",
  };
}

export async function hashReleaseArchives(root, evidence, inputs) {
  for (const archive of evidence?.archiveHashes ?? []) {
    if (
      !archive.path?.startsWith("artifacts/") ||
      !archive.path.endsWith(".tgz")
    )
      throw new Error("Packed archives must be .tgz files below artifacts/.");
    inputs[archive.path] = digest(
      await readFile(localPath(root, archive.path)),
    );
  }
  return inputs;
}
