import { Platform } from 'react-native';

import { recordAuthDiagnosticEvent } from './AuthDiagnostic';
import { AuthUserFacingError } from './AuthErrorMapper';
import { getGoogleClientIds } from './googleConfig';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

declare const require: (moduleName: string) => GoogleSignInModule;

export type GoogleCredential = {
  accessToken?: string;
  idToken: string;
};

export async function signInWithNativeGoogle(): Promise<GoogleCredential> {
  recordAuthDiagnosticEvent('google:start');

  if (Platform.OS !== 'ios') {
    throw new AuthUserFacingError(
      'configuration',
      'O login nativo do Google está configurado apenas para iOS nesta fase.',
    );
  }

  const { webClientId } = getGoogleClientIds();

  if (!webClientId) {
    recordAuthDiagnosticEvent('google:config-missing');
    throw new AuthUserFacingError(
      'configuration',
      'Client IDs do Google não configurados para o login nativo.',
    );
  }

  const { GoogleSignin } = require('@react-native-google-signin/google-signin');

  // On iOS, the native module reads CLIENT_ID from the bundled
  // GoogleService-Info.plist selected for the current native target.
  GoogleSignin.configure({ webClientId });

  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    recordAuthDiagnosticEvent('google:cancelled');
    throw new AuthUserFacingError('cancelled', 'O login foi cancelado.');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    recordAuthDiagnosticEvent('google:credential-missing');
    throw new AuthUserFacingError(
      'configuration',
      'O Google não retornou um ID Token válido para o Firebase.',
    );
  }

  recordAuthDiagnosticEvent('google:credential-received', 'idToken-present');
  return { idToken };
}
