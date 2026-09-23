import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import plist from '@expo/plist';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { signInWithNativeGoogle } from '@/services/auth/NativeGoogleSignInService';
import { getAuthDiagnosticEvents, resetAuthDiagnosticEvents } from '@/services/auth/AuthDiagnostic';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
  },
}));

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

const finalPlist = plist.parse(
  readFileSync(resolve(__dirname, '../../GoogleService-Info.final.plist'), 'utf8'),
);
const finalClientId = finalPlist.CLIENT_ID;

if (typeof finalClientId !== 'string') {
  throw new Error('GoogleService-Info.final.plist não contém CLIENT_ID.');
}

describe('NativeGoogleSignInService', () => {
  const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const originalWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  beforeEach(() => {
    resetAuthDiagnosticEvents();
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    mockedConstants.expoConfig = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIosClientId;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalWebClientId;
  });

  it('configures iOS Google Sign-In and returns the ID token', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token',
        scopes: [],
        serverAuthCode: null,
        user: {
          email: 'luanr.rigatti@gmail.com',
          familyName: null,
          givenName: null,
          id: 'google-user',
          name: 'Luan',
          photo: null,
        },
      },
    });

    await expect(signInWithNativeGoogle()).resolves.toEqual({ idToken: 'google-id-token' });
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
    expect(getAuthDiagnosticEvents()).toEqual([
      'google:start',
      'google:credential-received:idToken-present',
    ]);
  });

  it('does not pass the Dev environment iOS client ID to Final Google Sign-In', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'default-client-id';
    mockedConstants.expoConfig = {
      extra: {
        appVariant: 'final',
        googleIosClientId: finalClientId,
      },
      ios: { bundleIdentifier: 'com.pareact.mobile.final' },
    };
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'final-google-id-token',
        scopes: [],
        serverAuthCode: null,
        user: {
          email: 'final@example.com',
          familyName: null,
          givenName: null,
          id: 'final-google-user',
          name: 'Final User',
          photo: null,
        },
      },
    });

    await expect(signInWithNativeGoogle()).resolves.toEqual({
      idToken: 'final-google-id-token',
    });
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
  });

  it('maps native cancellation to the existing auth error contract', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithNativeGoogle()).rejects.toMatchObject({ code: 'cancelled' });
  });
});
