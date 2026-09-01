const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { IOSConfig } = require('@expo/config-plugins');

const projectRoot = path.resolve(process.cwd());
const plistPath = path.join(projectRoot, 'GoogleService-Info.final.plist');
const expectedBundleIdentifier = 'com.pareact.mobile.final';

function readPlistString(contents, key) {
  const match = contents.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1]?.trim();
}

function getReversedClientId(clientId) {
  const suffix = '.apps.googleusercontent.com';
  return clientId.endsWith(suffix)
    ? `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`
    : undefined;
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

if (getReversedClientId(clientId) !== reversedClientId) {
  console.error(
    '[ios:prebuild:final] CLIENT_ID e REVERSED_CLIENT_ID do plist Final não correspondem entre si.',
  );
  process.exit(1);
}

process.env.APP_VARIANT = 'final';
const appConfigPath = path.join(projectRoot, 'app.config.js');
delete require.cache[require.resolve(appConfigPath)];
const appConfig = require(appConfigPath).expo;
const configuredSchemes = Array.isArray(appConfig.scheme)
  ? appConfig.scheme
  : [appConfig.scheme];
const generatedInfoPlist = IOSConfig.Scheme.setScheme(appConfig, {});
const generatedUrlSchemes = IOSConfig.Scheme.getSchemesFromPlist(generatedInfoPlist);

if (
  appConfig.name !== 'Empório Rigatti Final' ||
  appConfig.ios?.bundleIdentifier !== expectedBundleIdentifier ||
  appConfig.ios?.googleServicesFile !== './GoogleService-Info.final.plist' ||
  appConfig.extra?.appVariant !== 'final' ||
  appConfig.extra?.googleIosClientId !== clientId ||
  !configuredSchemes.includes('pareact-final') ||
  !configuredSchemes.includes(reversedClientId) ||
  !generatedUrlSchemes.includes(reversedClientId)
) {
  console.error(
    '[ios:prebuild:final] O REVERSED_CLIENT_ID do plist Final não está presente no CFBundleURLTypes que o Expo gerará.',
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
