import Constants from 'expo-constants';

export type AppVariant = 'default' | 'final';

export function getAppVariant(): AppVariant {
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

  return getAppVariant() === 'final' ? 'pareact-final' : 'pareact';
}
