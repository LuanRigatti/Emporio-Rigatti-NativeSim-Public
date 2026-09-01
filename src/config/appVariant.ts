import Constants from 'expo-constants';

export type AppVariant = 'default' | 'final';

export function getAppVariant(): AppVariant {
  return Constants.expoConfig?.extra?.appVariant === 'final' ? 'final' : 'default';
}

export function getAppScheme(): string {
  const configuredScheme = Constants.expoConfig?.scheme;
  if (typeof configuredScheme === 'string' && configuredScheme.length > 0) {
    return configuredScheme;
  }

  return getAppVariant() === 'final' ? 'pareact-final' : 'pareact';
}
