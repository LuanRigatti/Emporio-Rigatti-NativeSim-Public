const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(process.cwd());
const plistPath = path.join(projectRoot, 'GoogleService-Info.final.plist');
const expectedBundleIdentifier = 'com.pareact.mobile.final';

function readPlistString(contents, key) {
  const match = contents.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1]?.trim();
}

if (!fs.existsSync(plistPath)) {
  console.error(
    '[ios:prebuild:final] GoogleService-Info.final.plist não encontrado. Baixe o plist do app iOS com bundle ID com.pareact.mobile.final no Firebase antes do prebuild.',
  );
  process.exit(1);
}

const plistContents = fs.readFileSync(plistPath, 'utf8');
const bundleIdentifier = readPlistString(plistContents, 'BUNDLE_ID');
const clientId = readPlistString(plistContents, 'CLIENT_ID');
const reversedClientId = readPlistString(plistContents, 'REVERSED_CLIENT_ID');

if (bundleIdentifier !== expectedBundleIdentifier) {
  console.error(
    `[ios:prebuild:final] BUNDLE_ID incompatível no plist Final: esperado ${expectedBundleIdentifier}.`,
  );
  process.exit(1);
}

if (!clientId || !reversedClientId) {
  console.error(
    '[ios:prebuild:final] GoogleService-Info.final.plist precisa conter CLIENT_ID e REVERSED_CLIENT_ID.',
  );
  process.exit(1);
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCommand, ['expo', 'prebuild', '--platform', 'ios'], {
  cwd: projectRoot,
  env: { ...process.env, APP_VARIANT: 'final' },
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[ios:prebuild:final] Falha ao executar expo prebuild: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
