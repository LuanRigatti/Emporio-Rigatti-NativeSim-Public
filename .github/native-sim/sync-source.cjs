'use strict';

const crypto = require('node:crypto');
const { Buffer } = require('node:buffer');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EXPECTED_SOURCE_REPO = 'luanrigatti/emporiorigatti';
const MAX_GIT_BUFFER = 512 * 1024 * 1024;
const REQUIRED_PRESERVE_RULES = [
  '.github/workflows/native-sim.yml',
  '.github/native-sim/gate.cjs',
  '.github/native-sim/sync-source.cjs',
  '.github/native-sim/sync-preserve.json',
];

const SENSITIVE_PATHS = [
  { pattern: /(^|\/)\.env(?:\.[^/]*)?$/i, label: 'environment file' },
  {
    pattern:
      /\.(?:p12|pfx|cer|crt|pem|key|p8|mobileprovision|provision(?:ing)?profile|jks|keystore)$/i,
    label: 'certificate, private key, or provisioning material',
  },
  {
    pattern:
      /(^|\/)(?:\.npmrc|\.pypirc|\.netrc|credentials|credentials\.(?:json|ya?ml)|secrets?\.(?:json|ya?ml|txt)|token\.(?:json|txt)|service-account[^/]*\.json|firebase-adminsdk[^/]*\.json|id_rsa|id_ed25519)$/i,
    label: 'local credential file',
  },
  { pattern: /(^|\/)\.ssh\/[^/]+$/i, label: 'SSH credential file' },
  { pattern: /(^|\/)\.aws\/credentials$/i, label: 'cloud credentials file' },
];

const SENSITIVE_CONTENT = [
  {
    pattern: new RegExp(`${'-'.repeat(5)}BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY${'-'.repeat(5)}`, 'i'),
    label: 'private-key material',
  },
  {
    pattern: new RegExp(`${'-'.repeat(5)}BEGIN CERTIFICATE${'-'.repeat(5)}`, 'i'),
    label: 'certificate material',
  },
  {
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
    label: 'GitHub access token',
  },
  { pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/, label: 'GitLab access token' },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/, label: 'Slack access token' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key' },
  { pattern: /\bGOCSPX-[A-Za-z0-9_-]{16,}\b/, label: 'OAuth client secret' },
  { pattern: /\bya29\.[A-Za-z0-9_-]{20,}\b/, label: 'Google access token' },
  { pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/, label: 'API access token' },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/i, label: 'bearer access token' },
  {
    pattern: /"type"\s*:\s*"service_account"|"private_key"\s*:\s*"-----BEGIN/i,
    label: 'service-account credential',
  },
  {
    pattern:
      /["']?(?:client[_-]?secret|refresh[_-]?token|access[_-]?token|token|password)["']?\s*[:=]\s*["'](?!\s*["']|(?:YOUR|REPLACE|EXAMPLE|PLACEHOLDER|<|process\.env))[A-Za-z0-9/_+=.-]{16,}["']/i,
    label: 'embedded credential value',
  },
];

function fail(message) {
  throw new Error(message);
}

function git(repo, args, options = {}) {
  try {
    return execFileSync('git', ['--no-optional-locks', '-C', repo, ...args], {
      encoding: options.encoding === undefined ? 'utf8' : options.encoding,
      maxBuffer: MAX_GIT_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail(`Git operation failed: ${args[0]}.`);
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function assertSeparateRepositories(sourceRoot, destinationRoot) {
  const source = path.resolve(sourceRoot).toLowerCase();
  const destination = path.resolve(destinationRoot).toLowerCase();
  if (isInside(source, destination) || isInside(destination, source)) {
    fail('Source and NativeSim Public repositories must be separate, non-overlapping directories.');
  }
}

function assertGitWorktree(repo, label) {
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) {
    fail(`${label} path does not exist or is not a directory.`);
  }
  const topLevel = git(repo, ['rev-parse', '--show-toplevel']).trim();
  if (!topLevel) fail(`${label} is not a Git working tree.`);
  return fs.realpathSync(topLevel);
}

function parseGithubIdentity(remote) {
  let host;
  let remotePath;
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(remote);
  const hasUrlScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(remote);

  try {
    if (hasUrlScheme) {
      const parsed = new URL(remote);
      host = parsed.hostname;
      remotePath = parsed.pathname;
    } else if (scp) {
      host = scp[1];
      remotePath = scp[2];
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (host.toLowerCase() !== 'github.com') return null;
  const identity = remotePath
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, '')
    .toLowerCase();
  return identity || null;
}

function sanitizeRemote(remote) {
  const githubIdentity = parseGithubIdentity(remote);
  if (githubIdentity) return `github.com/${githubIdentity}`;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(remote)) {
    try {
      const parsed = new URL(remote);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\.git$/i, '')}`;
    } catch {
      return '(unrecognized remote URL)';
    }
  }

  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(remote);
  if (scp) return `${scp[1]}/${scp[2].replace(/\.git$/i, '')}`;
  return '(unrecognized remote URL)';
}

function auditRemotes(sourceRoot, log) {
  const names = git(sourceRoot, ['remote']).split(/\r?\n/).filter(Boolean);
  const remotes = names.map((name) => git(sourceRoot, ['remote', 'get-url', name]).trim());
  const identities = remotes.map(parseGithubIdentity).filter(Boolean);

  if (remotes.length === 0) {
    log('Source remotes: unavailable; repository identity could not be confirmed.');
    return;
  }

  log(`Source remotes: ${remotes.map(sanitizeRemote).join(', ')}`);
  if (identities.length > 0 && !identities.includes(EXPECTED_SOURCE_REPO)) {
    fail(`GitHub remote does not match the expected source repository ${EXPECTED_SOURCE_REPO}.`);
  }
  if (identities.includes(EXPECTED_SOURCE_REPO)) {
    log('Source repository identity: confirmed.');
  } else {
    log('Source repository identity: not verifiable from configured remotes.');
  }
}

function validateRepoOverlapPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    fail('Snapshot contains an empty path.');
  }
  if (relativePath.includes('\0') || relativePath.includes('\\') || relativePath.startsWith('/')) {
    fail(`Snapshot contains an unsupported path: ${relativePath}.`);
  }

  const segments = relativePath.split('/');
  if (
    segments.some(
      (segment) =>
        segment === '' ||
        segment === '.' ||
        segment === '..' ||
        /[<>:"|?*]/.test(segment) ||
        /[. ]$/.test(segment),
    )
  ) {
    fail(`Snapshot contains a path that is unsafe on supported filesystems: ${relativePath}.`);
  }
  if (segments.some((segment) => segment.toLowerCase() === '.git')) {
    fail(`Snapshot cannot contain Git metadata: ${relativePath}.`);
  }
  if (
    segments.some((segment) => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment))
  ) {
    fail(`Snapshot contains a reserved filesystem path: ${relativePath}.`);
  }
  return relativePath;
}

function collectSourceEntries(sourceRoot, commit) {
  const output = git(sourceRoot, ['ls-tree', '-r', '-z', '--full-tree', commit], {
    encoding: null,
  });
  const records = [];
  let recordStart = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === 0) {
      if (index > recordStart) records.push(output.subarray(recordStart, index));
      recordStart = index + 1;
    }
  }
  if (recordStart !== output.length) fail('Git returned an unterminated committed tree entry.');
  const entries = new Map();
  const foldedPaths = new Set();

  for (const record of records) {
    const tab = record.indexOf(0x09);
    if (tab < 0) fail('Git returned a malformed committed tree entry.');
    const metadata = record.subarray(0, tab).toString('ascii').split(' ');
    const pathBytes = record.slice(tab + 1);
    const relativePath = pathBytes.toString('utf8');
    if (!Buffer.from(relativePath, 'utf8').equals(pathBytes)) {
      fail('Snapshot contains a path that is not valid UTF-8.');
    }
    validateRepoOverlapPath(relativePath);

    const [mode, type, objectId] = metadata;
    if (mode === '120000') fail(`Snapshot symlinks are not supported: ${relativePath}.`);
    if (mode === '160000' || type === 'commit')
      fail(`Snapshot submodules are not supported: ${relativePath}.`);
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) {
      fail(`Snapshot contains an unsupported Git entry: ${relativePath}.`);
    }

    const folded = relativePath.toLowerCase();
    if (foldedPaths.has(folded)) fail(`Snapshot has case-colliding paths: ${relativePath}.`);
    foldedPaths.add(folded);
    entries.set(relativePath, { objectId, type: 'file' });
  }

  if (entries.size === 0) fail('The selected commit contains no files; refusing an empty mirror.');
  return entries;
}

function getBlob(sourceRoot, objectId) {
  return git(sourceRoot, ['cat-file', 'blob', objectId], { encoding: null });
}

function loadPreserveRules(destinationRoot, configPath) {
  let config;
  try {
    const stat = fs.lstatSync(configPath);
    if (!stat.isFile() || stat.isSymbolicLink())
      fail('The NativeSim preserve allowlist must be a regular file.');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    fail('Could not read the NativeSim preserve allowlist JSON.');
  }
  if (!config || config.version !== 1 || !Array.isArray(config.preserve)) {
    fail('The NativeSim preserve allowlist must have version 1 and a preserve array.');
  }

  const seen = new Set();
  const rules = config.preserve.map((entry) => {
    if (typeof entry !== 'string') fail('Preserve allowlist entries must be strings.');
    const subtree = entry.endsWith('/**');
    const relativePath = validateRepoOverlapPath(subtree ? entry.slice(0, -3) : entry);
    const key = `${subtree ? 'tree' : 'file'}:${relativePath}`;
    if (seen.has(key)) fail(`Duplicate preserve rule: ${entry}.`);
    seen.add(key);
    return { path: relativePath, subtree, source: entry };
  });

  if (rules.length === 0) fail('The NativeSim preserve allowlist cannot be empty.');
  for (const requiredPath of REQUIRED_PRESERVE_RULES) {
    if (!rules.some((rule) => !rule.subtree && rule.path === requiredPath)) {
      fail(`Required NativeSim preserve path is missing: ${requiredPath}.`);
    }
  }
  return rules;
}

function isPreserved(relativePath, rules) {
  return rules.some(
    (rule) =>
      relativePath === rule.path || (rule.subtree && relativePath.startsWith(`${rule.path}/`)),
  );
}

function touchesPreserve(relativePath, rules) {
  return rules.some(
    (rule) =>
      relativePath === rule.path ||
      relativePath.startsWith(`${rule.path}/`) ||
      rule.path.startsWith(`${relativePath}/`),
  );
}

function assertNoPreserveAncestorFiles(paths, rules) {
  for (const relativePath of paths) {
    for (const rule of rules) {
      if (rule.path.startsWith(`${relativePath}/`)) {
        fail(`A file conflicts with a preserved directory path: ${relativePath}.`);
      }
    }
  }
}

function collectDestinationEntries(destinationRoot) {
  const entries = new Map();
  const directories = [];
  const foldedPaths = new Set();

  function visit(absoluteDirectory, relativeDirectory) {
    let children;
    try {
      children = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
    } catch {
      fail(`Could not inspect destination directory: ${relativeDirectory || '.'}.`);
    }
    children.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const child of children) {
      if (!relativeDirectory && child.name === '.git') continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${child.name}` : child.name;
      validateRepoOverlapPath(relativePath);
      const folded = relativePath.toLowerCase();
      if (foldedPaths.has(folded)) fail(`Destination has case-colliding paths: ${relativePath}.`);
      foldedPaths.add(folded);

      const absolutePath = path.join(absoluteDirectory, child.name);
      if (child.isSymbolicLink()) {
        entries.set(relativePath, { type: 'symlink', absolutePath });
      } else if (child.isDirectory()) {
        directories.push(relativePath);
        visit(absolutePath, relativePath);
      } else if (child.isFile()) {
        entries.set(relativePath, { type: 'file', absolutePath });
      } else {
        fail(`Destination contains an unsupported filesystem entry: ${relativePath}.`);
      }
    }
  }

  visit(destinationRoot, '');
  return { entries, directories };
}

function sensitivePathReason(relativePath) {
  for (const item of SENSITIVE_PATHS) {
    if (item.pattern.test(relativePath)) return item.label;
  }
  return null;
}

function sensitiveContentReason(buffer) {
  const text = buffer.toString('latin1');
  for (const item of SENSITIVE_CONTENT) {
    if (item.pattern.test(text)) return item.label;
  }
  return null;
}

function assertSafePath(relativePath, context) {
  const reason = sensitivePathReason(relativePath);
  if (reason) fail(`Sensitive ${context} blocked (${reason}): ${relativePath}.`);
}

function assertSafeContent(relativePath, buffer, context) {
  const reason = sensitiveContentReason(buffer);
  if (reason)
    fail(
      `Sensitive ${context} blocked (${reason}): ${relativePath}. Matched content was not printed.`,
    );
}

function fileDigest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function computePlan(sourceEntries, destinationEntries, rules, destinationRoot) {
  const added = [];
  const modified = [];
  const deleted = [];
  const unchanged = [];
  const preserved = [...destinationEntries.keys()]
    .filter((relativePath) => isPreserved(relativePath, rules))
    .sort();

  for (const [relativePath, sourceEntry] of sourceEntries) {
    if (isPreserved(relativePath, rules)) continue;
    const destinationEntry = destinationEntries.get(relativePath);
    if (!destinationEntry) {
      added.push(relativePath);
      continue;
    }
    if (destinationEntry.type !== 'file') {
      modified.push(relativePath);
      continue;
    }
    const bytes = fs.readFileSync(path.join(destinationRoot, ...relativePath.split('/')));
    if (fileDigest(bytes) === sourceEntry.sha256) unchanged.push(relativePath);
    else modified.push(relativePath);
  }

  for (const relativePath of destinationEntries.keys()) {
    if (!isPreserved(relativePath, rules) && !sourceEntries.has(relativePath))
      deleted.push(relativePath);
  }

  for (const list of [added, modified, deleted, unchanged]) list.sort();
  preserved.sort();
  return { added, modified, deleted, unchanged, preserved };
}

function reportPlan(plan, log) {
  log(
    `Mirror plan: added=${plan.added.length}, modified=${plan.modified.length}, deleted=${plan.deleted.length}, preserved=${plan.preserved.length}, unchanged=${plan.unchanged.length}`,
  );
  for (const key of ['added', 'modified', 'deleted', 'preserved']) {
    log(`${key}: ${plan[key].length ? plan[key].join(', ') : '(none)'}`);
  }
}

function removeEmptyDirectories(destinationRoot, directories, rules) {
  for (const relativePath of [...directories].sort(
    (left, right) =>
      right.split('/').length - left.split('/').length ||
      (right < left ? -1 : right > left ? 1 : 0),
  )) {
    if (touchesPreserve(relativePath, rules)) continue;
    const absolutePath = path.join(destinationRoot, ...relativePath.split('/'));
    try {
      fs.rmdirSync(absolutePath);
    } catch (error) {
      if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(error.code)) throw error;
    }
  }
}

function applyPlan({ destinationRoot, destinationEntries, directories, rules, plan, stagingRoot }) {
  for (const relativePath of plan.deleted) {
    const entry = destinationEntries.get(relativePath);
    if (entry && ['file', 'symlink'].includes(entry.type)) fs.unlinkSync(entry.absolutePath);
  }
  removeEmptyDirectories(destinationRoot, directories, rules);

  for (const relativePath of [...plan.added, ...plan.modified].sort()) {
    const absolutePath = path.join(destinationRoot, ...relativePath.split('/'));
    const existing = destinationEntries.get(relativePath);
    if (existing?.type === 'symlink') fs.unlinkSync(existing.absolutePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const stagedPath = path.join(stagingRoot, ...relativePath.split('/'));
    fs.copyFileSync(stagedPath, absolutePath);
  }
}

function createStagingSnapshot({ sourceRoot, sourceEntries, plan }) {
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nativesim-sync-stage-'));
  try {
    for (const relativePath of [...plan.added, ...plan.modified].sort()) {
      const sourceEntry = sourceEntries.get(relativePath);
      const bytes = getBlob(sourceRoot, sourceEntry.objectId);
      if (fileDigest(bytes) !== sourceEntry.sha256) {
        fail(`Git blob verification failed before mirror write: ${relativePath}.`);
      }
      const stagedPath = path.join(stagingRoot, ...relativePath.split('/'));
      fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
      fs.writeFileSync(stagedPath, bytes, { flag: 'wx' });
    }
    return stagingRoot;
  } catch (error) {
    removeStagingSnapshot(stagingRoot);
    throw error;
  }
}

function removeStagingSnapshot(stagingRoot) {
  const resolvedTemp = fs.realpathSync(os.tmpdir());
  const resolvedStage = fs.realpathSync(stagingRoot);
  const relative = path.relative(resolvedTemp, resolvedStage);
  if (
    path.basename(resolvedStage).startsWith('nativesim-sync-stage-') &&
    relative &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  ) {
    fs.rmSync(resolvedStage, { recursive: true, force: true });
  } else {
    fail('Refusing to remove a staging path outside the generated temporary directory.');
  }
}

function verifyMirror({ sourceRoot, commit, destinationRoot, rules, validatedSourceEntries }) {
  const sourceEntries = validatedSourceEntries || collectSourceEntries(sourceRoot, commit);
  if (!validatedSourceEntries) scanCommittedSource(sourceRoot, sourceEntries);
  const { entries: destinationEntries } = collectDestinationEntries(destinationRoot);
  const plan = computePlan(sourceEntries, destinationEntries, rules, destinationRoot);
  if (plan.added.length || plan.modified.length || plan.deleted.length) {
    fail(
      `Post-mirror verification failed: added=${plan.added.length}, modified=${plan.modified.length}, deleted=${plan.deleted.length}.`,
    );
  }
  return plan;
}

function assertCleanDestination(destinationRoot) {
  const status = git(destinationRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.trim()) {
    fail(
      'NativeSim Public working tree is not clean; refusing to overwrite local destination changes.',
    );
  }
}

function resolveCommit(sourceRoot, ref) {
  const commit = git(sourceRoot, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${ref}^{commit}`,
  ]).trim();
  if (!/^[0-9a-f]{40,64}$/i.test(commit))
    fail('Git did not resolve the requested ref to a full commit SHA.');
  if (git(sourceRoot, ['cat-file', '-t', commit]).trim() !== 'commit')
    fail('The requested ref does not resolve to a commit.');
  return commit.toLowerCase();
}

function auditSourceStatus(sourceRoot, log) {
  const status = git(sourceRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  log(
    `Source local changes: ${status.trim() ? 'detected; staged, unstaged, and untracked changes will be ignored' : 'none detected'}.`,
  );
}

function scanCommittedSource(sourceRoot, entries) {
  for (const [relativePath, entry] of entries) {
    assertSafePath(relativePath, 'source path');
    const bytes = getBlob(sourceRoot, entry.objectId);
    assertSafeContent(relativePath, bytes, 'source content');
    entry.sha256 = fileDigest(bytes);
  }
}

function scanPreservedDestination(entries, rules) {
  for (const [relativePath, entry] of entries) {
    assertSafePath(relativePath, 'destination path');
    if (
      !isPreserved(relativePath, rules) ||
      relativePath === 'build/native-sim-derived-data' ||
      relativePath.startsWith('build/native-sim-derived-data/')
    ) {
      continue;
    }
    if (entry.type !== 'file') fail(`Preserved path cannot be a symbolic link: ${relativePath}.`);
    assertSafePath(relativePath, 'preserved destination path');
    assertSafeContent(
      relativePath,
      fs.readFileSync(entry.absolutePath),
      'preserved destination content',
    );
  }
}

function synchronize({ sourcePath, ref, destinationRoot, dryRun = false, log = () => {} }) {
  if (!sourcePath || !ref || !destinationRoot)
    fail('sourcePath, ref, and destinationRoot are required.');
  const requestedSource = path.resolve(sourcePath);
  const sourceRoot = assertGitWorktree(requestedSource, 'Source');
  const destination = fs.realpathSync(destinationRoot);
  assertGitWorktree(destination, 'NativeSim Public destination');
  if (git(destination, ['rev-parse', '--show-prefix']).trim() !== '') {
    fail('NativeSim Public destination must be the root of its Git working tree.');
  }
  assertSeparateRepositories(sourceRoot, destination);

  const commit = resolveCommit(sourceRoot, ref);
  log(`Source commit: ${commit}`);
  auditRemotes(sourceRoot, log);
  auditSourceStatus(sourceRoot, log);
  assertCleanDestination(destination);

  const configPath = path.join(destination, '.github', 'native-sim', 'sync-preserve.json');
  const rules = loadPreserveRules(destination, configPath);
  const sourceEntries = collectSourceEntries(sourceRoot, commit);
  const { entries: destinationEntries, directories } = collectDestinationEntries(destination);
  assertNoPreserveAncestorFiles([...sourceEntries.keys(), ...destinationEntries.keys()], rules);

  scanCommittedSource(sourceRoot, sourceEntries);
  scanPreservedDestination(destinationEntries, rules);

  const plan = computePlan(sourceEntries, destinationEntries, rules, destination);
  reportPlan(plan, log);

  if (dryRun) {
    log('Dry run: no repository files were modified.');
    return { commit, plan, dryRun: true };
  }

  const stagingRoot = createStagingSnapshot({ sourceRoot, sourceEntries, plan });
  try {
    applyPlan({
      destinationRoot: destination,
      destinationEntries,
      directories,
      rules,
      plan,
      stagingRoot,
    });
  } finally {
    removeStagingSnapshot(stagingRoot);
  }
  const verified = verifyMirror({
    sourceRoot,
    commit,
    destinationRoot: destination,
    rules,
    validatedSourceEntries: sourceEntries,
  });
  log(
    `Post-mirror verification: exact outside preserve allowlist (${verified.unchanged.length} files).`,
  );
  reportPlan(plan, log);
  return { commit, plan, dryRun: false };
}

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--source' || argument === '--ref') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${argument} requires a value.`);
      const key = argument === '--source' ? 'sourcePath' : 'ref';
      if (options[key]) fail(`${argument} may be specified only once.`);
      options[key] = value;
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${argument}.`);
  }
  if (!options.sourcePath || !options.ref) {
    fail(
      'Usage: node .github/native-sim/sync-source.cjs --source <repo-path> --ref <sha-or-ref> [--dry-run]',
    );
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const scriptDirectory = path.dirname(path.resolve(process.argv[1]));
    const destinationRoot = path.resolve(scriptDirectory, '../..');
    synchronize({ ...options, destinationRoot, log: console.log });
  } catch (error) {
    console.error(`NativeSim snapshot sync refused: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  collectDestinationEntries,
  collectSourceEntries,
  loadPreserveRules,
  parseArgs,
  parseGithubIdentity,
  sanitizeRemote,
  sensitiveContentReason,
  sensitivePathReason,
  synchronize,
  verifyMirror,
};
