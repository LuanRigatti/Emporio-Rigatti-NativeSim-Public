import { Platform } from 'react-native';

import { AuthUserFacingError } from './AuthErrorMapper';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

declare const require: (moduleName: string) => GoogleSignInModule;

export type GoogleCredential = {
  accessToken?: string;
  idToken: string;
};

export async function signInWithNativeGoogle(): Promise<GoogleCredential> {
  if (Platform.OS !== 'ios') {
    throw new AuthUserFacingError(
      'configuration',
      'O login nativo do Google está configurado apenas para iOS nesta fase.',
    );
  }

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!iosClientId || !webClientId) {
    throw new AuthUserFacingError(
      'configuration',
      'Client IDs do Google não configurados para o login nativo.',
    );
  }

  const { GoogleSignin } = require('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    iosClientId,
    webClientId,
  });

  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    throw new AuthUserFacingError('cancelled', 'O login foi cancelado.');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new AuthUserFacingError(
      'configuration',
      'O Google não retornou um ID Token válido para o Firebase.',
    );
  }

  return { idToken };
}
