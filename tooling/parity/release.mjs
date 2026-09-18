import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  collectReleaseInputs,
  expectedApiModules,
  expectedSuites,
  hashReleaseArchives,
  readEvidenceArtifact,
  validateReleaseEvidence,
} from "./release-evidence.mjs";

const root = resolve(import.meta.dirname, "../..");
const failures = [];
let details;
function preserveOriginals() {
  const guard = spawnSync(
    process.execPath,
    ["tooling/parity/preserve.mjs", "verify"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (guard.status !== 0)
    failures.push(
      `Original-file guard failed: ${guard.stderr || guard.stdout}`,
    );
  else if (JSON.parse(guard.stdout).passed !== true)
    failures.push("Original-file guard did not pass.");
}
try {
  preserveOriginals();
  const pins = JSON.parse(
    await readFile(resolve(import.meta.dirname, "upstreams.json"), "utf8"),
  );
  for (const [repository, { commit }] of Object.entries(pins)) {
    const originalDiff = spawnSync(
      "git",
      ["-C", repository, "diff", "--name-only", commit, "--"],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (originalDiff.status !== 0 || originalDiff.stdout.trim())
      failures.push(
        `${repository}: original tracked source differs from its pinned commit.`,
      );
  }
  const status = JSON.parse(
    await readFile(resolve(import.meta.dirname, "status.json"), "utf8"),
  );
  if (!status.migrationComplete || status.fullComponentParity !== "passed")
    failures.push(
      "Full behavior acceptance remains incomplete in status.json.",
    );
  const evidence = JSON.parse(
    await readFile(resolve(root, "artifacts/release-evidence.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "upstream-tests.sha256.json"),
      "utf8",
    ),
  );
  const currentInputs = await hashReleaseArchives(
    root,
    evidence,
    await collectReleaseInputs(root),
  );
  details = await validateReleaseEvidence({
    root,
    evidence,
    currentInputs,
    suites: expectedSuites(manifest),
    apiModules: await expectedApiModules(root),
    readArtifact: (reference) => readEvidenceArtifact(root, reference),
  });
  failures.push(...details.failures);
  const after = await hashReleaseArchives(
    root,
    evidence,
    await collectReleaseInputs(root),
  );
  if (JSON.stringify(currentInputs) !== JSON.stringify(after))
    failures.push("Release inputs changed while the evidence was checked.");
  preserveOriginals();
} catch (error) {
  failures.push(
    error.code === "ENOENT"
      ? `Required release evidence or build output is missing: ${error.path}.`
      : error.message,
  );
}
console.log(
  JSON.stringify(
    {
      check: "release-evidence",
      ...details,
      passed: !failures.length,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
