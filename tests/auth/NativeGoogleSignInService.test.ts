import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { signInWithNativeGoogle } from '@/services/auth/NativeGoogleSignInService';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
  },
}));

describe('NativeGoogleSignInService', () => {
  const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const originalWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
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
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      iosClientId: 'ios-client-id',
      webClientId: 'web-client-id',
    });
  });

  it('maps native cancellation to the existing auth error contract', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithNativeGoogle()).rejects.toMatchObject({ code: 'cancelled' });
  });
});
