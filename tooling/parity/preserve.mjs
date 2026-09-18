import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const lock = JSON.parse(readFileSync(resolve(directory, 'upstreams.json'), 'utf8'));
const snapshotPath = resolve(directory, 'upstream-tests.sha256.json');
const command = process.argv[2] ?? 'verify';
const MAX_BUFFER = 256 * 1024 * 1024;

// Protect fixtures, helpers, snapshots, and runner configuration as well as tests.
export function isProtected(path) {
  return /(^|\/)(?:tests?|__tests__|__snapshots__|test[-_]?utils)(?:\/|$)/i.test(path)
    || /(?:^|[./_-])(?:test|spec|snap)(?:[./_-]|$)/i.test(path)
    || /(?:^|\/)(?:vitest|jest|playwright|karma|cypress)(?:[./_-]|$)/i.test(path)
    || /(?:^|\/)test[-_]?utils(?:[./_-]|$)/i.test(path);
}

function git(repository, args, input) {
  return execFileSync('git', ['-C', resolve(root, repository), ...args], {
    input,
    maxBuffer: MAX_BUFFER,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function nulStrings(bytes) {
  return bytes.toString('utf8').split('\0').filter(Boolean);
}

function originalFiles(repository, commit) {
  const entries = nulStrings(git(repository, ['ls-tree', '-rz', '--full-tree', commit]))
    .map((line) => {
      const separator = line.indexOf('\t');
      const [mode, type, blob] = line.slice(0, separator).split(' ');
      return { mode, type, blob, path: line.slice(separator + 1) };
    })
    .filter(({ path, type }) => type === 'blob' && isProtected(path))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

  const batch = git(repository, ['cat-file', '--batch'], entries.map(({ blob }) => blob).join('\n') + '\n');
  let offset = 0;
  const files = {};
  for (const { path, mode, blob } of entries) {
    const headerEnd = batch.indexOf(10, offset);
    const [actualBlob, type, sizeText] = batch.subarray(offset, headerEnd).toString('ascii').split(' ');
    const size = Number(sizeText);
    if (headerEnd < 0 || actualBlob !== blob || type !== 'blob' || !Number.isSafeInteger(size)) {
      throw new Error(`Cannot read original Git blob for ${repository}/${path}.`);
    }
    const bytes = batch.subarray(headerEnd + 1, headerEnd + 1 + size);
    if (bytes.length !== size || batch[headerEnd + 1 + size] !== 10) {
      throw new Error(`Incomplete Git blob for ${repository}/${path}.`);
    }
    files[path] = { sha256: sha256(bytes), bytes: size, mode, blob };
    offset = headerEnd + 1 + size + 1;
  }
  return files;
}

function originals() {
  return {
    format: 1,
    algorithm: 'sha256',
    repositories: Object.fromEntries(Object.entries(lock).map(([repository, { origin, commit }]) => [
      repository,
      { origin, commit, files: originalFiles(repository, commit) },
    ])),
  };
}

function verify() {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const expected = originals();
  if (JSON.stringify(snapshot) !== JSON.stringify(expected)) {
    throw new Error('The checksum snapshot does not match the pinned original Git commits.');
  }

  const failures = [];
  const summaries = [];
  for (const [repository, { commit, files }] of Object.entries(expected.repositories)) {
    const paths = new Set(nulStrings(git(repository, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])));
    for (const path of paths) {
      if (isProtected(path) && !Object.hasOwn(files, path)) {
        failures.push(`${repository}/${path}: added protected file.`);
      }
    }
    const staged = nulStrings(git(repository, ['diff', '--cached', '--name-only', '-z', commit]));
    for (const path of staged.filter(isProtected)) {
      failures.push(`${repository}/${path}: protected change in the Git index.`);
    }
    for (const [path, record] of Object.entries(files)) {
      try {
        const absolutePath = resolve(root, repository, path);
        const stat = lstatSync(absolutePath);
        const symlink = record.mode === '120000';
        if (symlink !== stat.isSymbolicLink() || (!symlink && !stat.isFile())) {
          failures.push(`${repository}/${path}: file type changed.`);
          continue;
        }
        const bytes = symlink ? Buffer.from(readlinkSync(absolutePath)) : readFileSync(absolutePath);
        if (sha256(bytes) !== record.sha256) {
          failures.push(`${repository}/${path}: contents changed.`);
        }
        if (!symlink && Boolean(stat.mode & 0o111) !== (record.mode === '100755')) {
          failures.push(`${repository}/${path}: executable permission changed.`);
        }
      } catch (error) {
        failures.push(`${repository}/${path}: ${error.code ?? error.message}.`);
      }
    }
    summaries.push({ repository, commit, protectedFiles: Object.keys(files).length });
  }
  console.log(JSON.stringify({ check: 'upstream-test-preservation', passed: failures.length === 0, summaries, failures }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

try {
  if (command === 'snapshot') {
    // Write only to stdout. This command never changes a clone or an existing baseline.
    console.log(JSON.stringify(originals(), null, 2));
  } else if (command === 'verify') {
    verify();
  } else {
    throw new Error('Use: node tooling/parity/preserve.mjs [snapshot|verify]');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
