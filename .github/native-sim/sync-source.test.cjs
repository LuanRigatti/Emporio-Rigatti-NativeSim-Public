'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const nativeSimDirectory = path.dirname(require.resolve('./sync-source.cjs'));

const {
  loadPreserveRules,
  parseGithubIdentity,
  sanitizeRemote,
  sensitiveContentReason,
  sensitivePathReason,
  synchronize,
  verifyMirror,
} = require('./sync-source.cjs');

const publicPreserveConfig = fs.readFileSync(require.resolve('./sync-preserve.json'));
const preserveFiles = {
  '.github/workflows/native-sim.yml': 'native workflow stays local\n',
  '.github/native-sim/gate.cjs': 'native gate stays local\n',
  '.github/native-sim/sync-source.cjs': 'sync script stays local\n',
  '.github/native-sim/sync-preserve.json': publicPreserveConfig,
  '.github/native-sim/sync-source.test.cjs': 'sync tests stay local\n',
  'build/native-sim-derived-data/cache.marker': 'native cache stays local\n',
};

test('the preserved sync tooling does not trigger its own credential-content scanner', () => {
  for (const filename of ['sync-source.cjs', 'sync-source.test.cjs', 'sync-preserve.json']) {
    const bytes = fs.readFileSync(path.join(nativeSimDirectory, filename));
    assert.equal(sensitiveContentReason(bytes), null, filename);
  }
});

test('remote audit confirms the source repository and strips URL credentials and query data', () => {
  const remote = 'https://user:password@github.com/LuanRigatti/emporiorigatti.git?token=value';
  const sanitized = sanitizeRemote(remote);

  assert.equal(parseGithubIdentity(remote), 'luanrigatti/emporiorigatti');
  assert.equal(sanitized, 'github.com/luanrigatti/emporiorigatti');
  assert.doesNotMatch(sanitized, /user|password|token|value/i);
  assert.equal(
    sanitizeRemote('git@github.com:LuanRigatti/emporiorigatti.git'),
    'github.com/luanrigatti/emporiorigatti',
  );
});

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
}

function initRepo(root, files) {
  fs.mkdirSync(root, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', root]);
  git(root, 'config', 'user.name', 'NativeSim sync test');
  git(root, 'config', 'user.email', 'nativesim-sync-test@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  writeFiles(root, files);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'fixture');
  return git(root, 'rev-parse', 'HEAD');
}

function createFixture(t, sourceFiles, destinationFiles) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nativesim-sync-test-'));
  t.after(() => {
    const resolvedRoot = fs.realpathSync(temporaryRoot);
    const resolvedTemp = fs.realpathSync(os.tmpdir());
    assert.ok(resolvedRoot.startsWith(`${resolvedTemp}${path.sep}`));
    fs.rmSync(resolvedRoot, { recursive: true, force: true });
  });

  const sourceRoot = path.join(temporaryRoot, 'source');
  const destinationRoot = path.join(temporaryRoot, 'public');
  const sourceCommit = initRepo(sourceRoot, sourceFiles);
  initRepo(destinationRoot, { ...preserveFiles, ...destinationFiles });

  return { sourceRoot, destinationRoot, sourceCommit };
}

function readRepoFiles(root) {
  const files = new Map();
  function visit(directory, relativeDirectory = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!relativeDirectory && entry.name === '.git') continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolutePath);
        files.set(relativePath, crypto.createHash('sha256').update(bytes).digest('hex'));
      }
    }
  }
  visit(root);
  return files;
}

function runSync(fixture, options = {}) {
  return synchronize({
    sourcePath: fixture.sourceRoot,
    ref: fixture.sourceCommit,
    destinationRoot: fixture.destinationRoot,
    log: () => {},
    ...options,
  });
}

test('clean committed snapshots report exact parity and preserve NativeSim-only files', (t) => {
  const fixture = createFixture(t, { 'app.txt': 'same\n' }, { 'app.txt': 'same\n' });
  const result = runSync(fixture, { dryRun: true });

  assert.deepEqual(result.plan.added, []);
  assert.deepEqual(result.plan.modified, []);
  assert.deepEqual(result.plan.deleted, []);
  assert.equal(result.plan.preserved.length, Object.keys(preserveFiles).length);
  assert.equal(result.dryRun, true);
});

test('staged, unstaged, and untracked source changes are reported but never copied or changed', (t) => {
  const fixture = createFixture(
    t,
    { 'app.txt': 'committed snapshot\n' },
    { 'app.txt': 'older destination\n' },
  );
  fs.writeFileSync(path.join(fixture.sourceRoot, 'app.txt'), 'staged-only change\n');
  git(fixture.sourceRoot, 'add', 'app.txt');
  fs.writeFileSync(path.join(fixture.sourceRoot, 'app.txt'), 'unstaged change\n');
  fs.writeFileSync(path.join(fixture.sourceRoot, 'local-only.txt'), 'untracked change\n');
  const sourceStatusBefore = git(
    fixture.sourceRoot,
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  );

  const result = runSync(fixture);

  assert.equal(
    fs.readFileSync(path.join(fixture.destinationRoot, 'app.txt'), 'utf8'),
    'committed snapshot\n',
  );
  assert.equal(fs.existsSync(path.join(fixture.destinationRoot, 'local-only.txt')), false);
  assert.equal(
    git(fixture.sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all'),
    sourceStatusBefore,
  );
  assert.equal(result.plan.modified.includes('app.txt'), true);
});

test('mirror adds, modifies, and deletes files outside the preserve allowlist', (t) => {
  const fixture = createFixture(
    t,
    { 'change.txt': 'new bytes\n', 'keep.txt': 'same bytes\n', 'added.txt': 'new file\n' },
    { 'change.txt': 'old bytes\n', 'keep.txt': 'same bytes\n', 'removed.txt': 'must go\n' },
  );

  const result = runSync(fixture);

  assert.deepEqual(result.plan.added, ['added.txt']);
  assert.deepEqual(result.plan.modified, ['change.txt']);
  assert.deepEqual(result.plan.deleted, ['removed.txt']);
  assert.equal(
    fs.readFileSync(path.join(fixture.destinationRoot, 'change.txt'), 'utf8'),
    'new bytes\n',
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.destinationRoot, 'added.txt'), 'utf8'),
    'new file\n',
  );
  assert.equal(fs.existsSync(path.join(fixture.destinationRoot, 'removed.txt')), false);
  assert.equal(
    fs.readFileSync(
      path.join(fixture.destinationRoot, 'build/native-sim-derived-data/cache.marker'),
      'utf8',
    ),
    'native cache stays local\n',
  );
});

test('preserved paths remain byte-identical even when the source has a different file there', (t) => {
  const fixture = createFixture(
    t,
    {
      '.github/workflows/native-sim.yml': 'source workflow must not replace NativeSim workflow\n',
      'app.txt': 'same\n',
    },
    { 'app.txt': 'same\n' },
  );
  const workflowPath = path.join(fixture.destinationRoot, '.github/workflows/native-sim.yml');
  const before = fs.readFileSync(workflowPath);

  runSync(fixture);

  assert.deepEqual(fs.readFileSync(workflowPath), before);
});

test('dry-run reports the plan without changing any destination file', (t) => {
  const fixture = createFixture(
    t,
    { 'app.txt': 'source\n', 'new.txt': 'new\n' },
    { 'app.txt': 'destination\n', 'remove.txt': 'extra\n' },
  );
  const beforeFiles = readRepoFiles(fixture.destinationRoot);
  const beforeStatus = git(
    fixture.destinationRoot,
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  );

  const result = runSync(fixture, { dryRun: true });

  assert.deepEqual(result.plan.added, ['new.txt']);
  assert.deepEqual(result.plan.modified, ['app.txt']);
  assert.deepEqual(result.plan.deleted, ['remove.txt']);
  assert.deepEqual(readRepoFiles(fixture.destinationRoot), beforeFiles);
  assert.equal(
    git(fixture.destinationRoot, 'status', '--porcelain=v1', '--untracked-files=all'),
    beforeStatus,
  );
});

test('a sensitive source path blocks the mirror before destination writes', (t) => {
  const fixture = createFixture(
    t,
    { 'app.txt': 'safe\n', '.env.local': 'NOT_A_REAL_SECRET\n' },
    { 'app.txt': 'old\n' },
  );
  const beforeFiles = readRepoFiles(fixture.destinationRoot);

  assert.throws(
    () => runSync(fixture),
    /Sensitive source path blocked \(environment file\): \.env\.local/,
  );
  assert.deepEqual(readRepoFiles(fixture.destinationRoot), beforeFiles);
});

test('only the three explicit environment template names bypass the environment-path rule', () => {
  for (const template of ['.env.example', '.env.sample', '.env.template']) {
    assert.equal(sensitivePathReason(`config/${template}`), null, template);
  }

  for (const environmentFile of [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '.env.example.local',
    '.env.sample.production',
    '.env.template.local',
  ]) {
    assert.equal(sensitivePathReason(environmentFile), 'environment file', environmentFile);
  }
});

test('safe environment templates are mirrored while still passing content inspection', (t) => {
  const sourceTemplates = {
    '.env.example': 'EXPO_PUBLIC_API_KEY=YOUR_API_KEY\n',
    '.env.sample': 'DATABASE_URL=https://example.invalid\n',
    '.env.template': 'SERVICE_TOKEN=REPLACE_WITH_TOKEN\n',
  };
  const fixture = createFixture(t, sourceTemplates, { 'app.txt': 'old\n' });

  const result = runSync(fixture);

  assert.deepEqual(result.plan.added, Object.keys(sourceTemplates));
  for (const [relativePath, expectedContent] of Object.entries(sourceTemplates)) {
    assert.equal(
      fs.readFileSync(path.join(fixture.destinationRoot, relativePath), 'utf8'),
      expectedContent,
    );
  }
});

test('an allowed environment template containing sensitive material still blocks the mirror', (t) => {
  const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const fixture = createFixture(
    t,
    { '.env.example': `PRIVATE_KEY=${privateKeyMarker}\n` },
    { 'app.txt': 'old\n' },
  );
  const beforeFiles = readRepoFiles(fixture.destinationRoot);

  assert.throws(
    () => runSync(fixture),
    /Sensitive source content blocked \(private-key material\): \.env\.example/,
  );
  assert.deepEqual(readRepoFiles(fixture.destinationRoot), beforeFiles);
});

test('credential-like content blocks the mirror without printing the matched value', (t) => {
  const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const fixture = createFixture(
    t,
    { 'notes.txt': `${privateKeyMarker}\nfake\n` },
    { 'app.txt': 'old\n' },
  );
  const beforeFiles = readRepoFiles(fixture.destinationRoot);

  assert.throws(
    () => runSync(fixture),
    (error) => {
      assert.match(error.message, /Sensitive source content blocked \(private-key material\)/);
      assert.doesNotMatch(error.message, /fake/);
      return true;
    },
  );
  assert.deepEqual(readRepoFiles(fixture.destinationRoot), beforeFiles);
});

test('the audited mocked Google idToken fixture does not block its exact source test file', (t) => {
  const fixtureToken = ['release-google-', 'id-', 'token'].join('');
  const mockTestSource = [
    'jest.mocked(GoogleSignin.signIn).mockResolvedValue({',
    `  data: { idToken: '${fixtureToken}' },`,
    '});',
    `expect(result).toEqual({ idToken: '${fixtureToken}' });`,
  ].join('\n');
  const fixture = createFixture(
    t,
    { 'tests/auth/NativeGoogleSignInService.test.ts': mockTestSource },
    { 'app.txt': 'old\n' },
  );

  assert.doesNotThrow(() => runSync(fixture, { dryRun: true }));
});

test('a different credential-shaped idToken in the same test file remains blocked', (t) => {
  const syntheticToken = [
    'eyJhbGciOiJub25l',
    'In0.eyJzdWIiOiJ0ZXN0In0.',
    'syntheticSignatureValue',
  ].join('');
  const mockTestSource = [
    'jest.mocked(GoogleSignin.signIn).mockResolvedValue({',
    `  data: { idToken: '${syntheticToken}' },`,
    '});',
  ].join('\n');
  const fixture = createFixture(
    t,
    { 'tests/auth/NativeGoogleSignInService.test.ts': mockTestSource },
    { 'app.txt': 'old\n' },
  );

  assert.throws(
    () => runSync(fixture, { dryRun: true }),
    /Sensitive source content blocked \(embedded credential value\)/,
  );
});

test('the audited fixture is not exempted from other files under tests', (t) => {
  const fixtureToken = ['release-google-', 'id-', 'token'].join('');
  const mockTestSource = `const idToken = '${fixtureToken}';`;
  const fixture = createFixture(
    t,
    { 'tests/auth/AnotherGoogleSignIn.test.ts': mockTestSource },
    { 'app.txt': 'old\n' },
  );

  assert.throws(
    () => runSync(fixture, { dryRun: true }),
    /Sensitive source content blocked \(embedded credential value\)/,
  );
});

test('JSON token values are detected and never included in the error message', (t) => {
  const fixture = createFixture(
    t,
    { 'settings.json': `{"access_token":"${'x'.repeat(32)}"}\n` },
    { 'app.txt': 'old\n' },
  );

  assert.throws(
    () => runSync(fixture),
    (error) => {
      assert.match(error.message, /Sensitive source content blocked \(embedded credential value\)/);
      assert.doesNotMatch(error.message, /x{32}/);
      return true;
    },
  );
});

test('post-mirror verification detects a destination change made after synchronization', (t) => {
  const fixture = createFixture(t, { 'app.txt': 'committed\n' }, { 'app.txt': 'old\n' });
  runSync(fixture);
  fs.writeFileSync(path.join(fixture.destinationRoot, 'app.txt'), 'unexpected post-mirror bytes\n');

  const configPath = path.join(fixture.destinationRoot, '.github/native-sim/sync-preserve.json');
  const rules = loadPreserveRules(fixture.destinationRoot, configPath);
  assert.throws(
    () =>
      verifyMirror({
        sourceRoot: fixture.sourceRoot,
        commit: fixture.sourceCommit,
        destinationRoot: fixture.destinationRoot,
        rules,
      }),
    /Post-mirror verification failed:.*modified=1/,
  );
});
