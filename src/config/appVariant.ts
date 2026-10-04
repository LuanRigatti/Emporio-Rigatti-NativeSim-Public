import Constants from 'expo-constants';

export type AppVariant = 'default' | 'final' | 'release';

export function getAppVariant(): AppVariant {
  if (
    Constants.expoConfig?.extra?.appVariant === 'release' ||
    Constants.expoConfig?.ios?.bundleIdentifier === 'com.pareact.mobile.release'
  ) {
    return 'release';
  }

  if (
    Constants.expoConfig?.extra?.appVariant === 'final' ||
    Constants.expoConfig?.ios?.bundleIdentifier === 'com.pareact.mobile.final'
  ) {
    return 'final';
  }

  return 'default';
}

export function getAppScheme(): string {
  const configuredScheme = Constants.expoConfig?.scheme;
  if (typeof configuredScheme === 'string' && configuredScheme.length > 0) {
    return configuredScheme;
  }

  const appVariant = getAppVariant();
  if (appVariant === 'final') return 'pareact-final';
  if (appVariant === 'release') return 'pareact-release';
  return 'pareact';
}
