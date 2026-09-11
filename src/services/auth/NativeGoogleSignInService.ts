import { Platform } from 'react-native';

import { AuthUserFacingError } from './AuthErrorMapper';
import { GoogleSignInDiagnosticError } from './GoogleSignInDiagnostics';
import { getGoogleClientIds } from './googleConfig';

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
      undefined,
      'GoogleSignin.configure',
    );
  }

  let iosClientId: string | undefined;
  let webClientId: string | undefined;
  try {
    ({ iosClientId, webClientId } = getGoogleClientIds());
  } catch (error) {
    throw new GoogleSignInDiagnosticError('GoogleSignin.configure', error);
  }

  if (!iosClientId || !webClientId) {
    throw new AuthUserFacingError(
      'configuration',
      'Client IDs do Google não configurados para o login nativo.',
      undefined,
      'GoogleSignin.configure',
    );
  }

  let GoogleSignin: GoogleSignInModule['GoogleSignin'];
  try {
    ({ GoogleSignin } = require('@react-native-google-signin/google-signin'));
  } catch (error) {
    throw new GoogleSignInDiagnosticError('GoogleSignin.configure', error);
  }

  try {
    GoogleSignin.configure({
      iosClientId,
      webClientId,
    });
  } catch (error) {
    throw new GoogleSignInDiagnosticError('GoogleSignin.configure', error);
  }

  let response: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    response = await GoogleSignin.signIn();
  } catch (error) {
    throw new GoogleSignInDiagnosticError('GoogleSignin.signIn', error);
  }

  if (response.type === 'cancelled') {
    throw new AuthUserFacingError(
      'cancelled',
      'O login foi cancelado.',
      undefined,
      'GoogleSignin.signIn',
    );
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new AuthUserFacingError(
      'configuration',
      'O Google não retornou um ID Token válido para o Firebase.',
      undefined,
      'obtenção do idToken',
    );
  }

  return { idToken };
}
