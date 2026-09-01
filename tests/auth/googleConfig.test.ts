import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import plist from '@expo/plist';
import { IOSConfig } from 'expo/config-plugins';
import Constants from 'expo-constants';
import type { ExpoConfig } from '@expo/config-types';

import { getAppVariant } from '@/config/appVariant';
import { getGoogleClientIds } from '@/services/auth/googleConfig';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null },
}));

const mockedConstants = Constants as unknown as {
  expoConfig: {
    extra?: { appVariant?: string; googleIosClientId?: string };
    ios?: { bundleIdentifier?: string };
  } | null;
};

const projectRoot = resolve(__dirname, '../..');
const appConfigPath = resolve(projectRoot, 'app.config.js');
const appConfigRequire = createRequire(__filename);

function readPlistString(fileName: string, key: string): string {
  const values = plist.parse(readFileSync(resolve(projectRoot, fileName), 'utf8'));
  const value = values[key];

  if (typeof value !== 'string') {
    throw new Error(`${fileName} não contém uma string ${key} válida.`);
  }

  return value;
}

function resolveExpoConfig(variant?: 'final'): ExpoConfig {
  const previousVariant = process.env.APP_VARIANT;

  if (variant) {
    process.env.APP_VARIANT = variant;
  } else {
    delete process.env.APP_VARIANT;
  }

  let config: ExpoConfig | undefined;
  jest.isolateModules(() => {
    config = appConfigRequire(appConfigPath).expo as ExpoConfig;
  });

  if (previousVariant === undefined) {
    delete process.env.APP_VARIANT;
  } else {
    process.env.APP_VARIANT = previousVariant;
  }

  if (!config) {
    throw new Error('Não foi possível resolver o app.config.js.');
  }

  return config;
}

function resolveGoogleInfoPlist(config: ExpoConfig) {
  const withExpoSchemes = IOSConfig.Scheme.setScheme(config, {});

  return IOSConfig.Google.setGoogleConfig(
    config,
    withExpoSchemes,
    { projectRoot } as Parameters<typeof IOSConfig.Google.setGoogleConfig>[2],
  );
}

const defaultClientId = readPlistString('GoogleService-Info.plist', 'CLIENT_ID');
const defaultReversedClientId = readPlistString(
  'GoogleService-Info.plist',
  'REVERSED_CLIENT_ID',
);
const finalClientId = readPlistString('GoogleService-Info.final.plist', 'CLIENT_ID');
const finalReversedClientId = readPlistString(
  'GoogleService-Info.final.plist',
  'REVERSED_CLIENT_ID',
);

describe('getGoogleClientIds', () => {
  const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  afterEach(() => {
    mockedConstants.expoConfig = null;
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIosClientId;
  });

  it('keeps the default variant tied to the standard plist', () => {
    const config = resolveExpoConfig();
    const infoPlist = resolveGoogleInfoPlist(config);
    const schemes = IOSConfig.Scheme.getSchemesFromPlist(infoPlist);

    expect(config.name).toBe('Empório Rigatti');
    expect(config.ios?.bundleIdentifier).toBe('com.pareact.mobile');
    expect(config.scheme).toBe('pareact');
    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.extra?.googleIosClientId).toBe(defaultClientId);
    expect(schemes).toEqual(
      expect.arrayContaining(['pareact', defaultReversedClientId]),
    );
    expect(defaultClientId).toBe(
      '83092109834-qgnbt884kefr1r2rmmt9i601v2u5t1oh.apps.googleusercontent.com',
    );
  });

  it('resolves the Final client ID from the Final plist and generates both URL schemes', () => {
    const config = resolveExpoConfig('final');
    const infoPlist = resolveGoogleInfoPlist(config);
    const schemes = IOSConfig.Scheme.getSchemesFromPlist(infoPlist);

    expect(config.name).toBe('Empório Rigatti Final');
    expect(config.ios?.bundleIdentifier).toBe('com.pareact.mobile.final');
    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.final.plist');
    expect(config.scheme).toEqual(['pareact-final', finalReversedClientId]);
    expect(config.extra?.appVariant).toBe('final');
    expect(config.extra?.googleIosClientId).toBe(finalClientId);
    expect(schemes).toEqual(
      expect.arrayContaining(['pareact-final', finalReversedClientId]),
    );
    expect(infoPlist.CFBundleURLTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CFBundleURLSchemes: expect.arrayContaining([finalReversedClientId]) }),
      ]),
    );
  });

  it('does not allow the .env.local default client to override Final', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = defaultClientId;
    mockedConstants.expoConfig = {
      extra: {
        appVariant: 'final',
        googleIosClientId: finalClientId,
      },
      ios: { bundleIdentifier: 'com.pareact.mobile.final' },
    };

    expect(getGoogleClientIds().iosClientId).toBe(finalClientId);
  });

  it('identifies Final by bundle ID even without the extra marker', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = defaultClientId;
    mockedConstants.expoConfig = {
      extra: { googleIosClientId: finalClientId },
      ios: { bundleIdentifier: 'com.pareact.mobile.final' },
    };

    expect(getAppVariant()).toBe('final');
    expect(getGoogleClientIds().iosClientId).toBe(finalClientId);

    mockedConstants.expoConfig = {
      extra: {},
      ios: { bundleIdentifier: 'com.pareact.mobile.final' },
    };

    expect(getGoogleClientIds().iosClientId).toBeUndefined();
  });
});
