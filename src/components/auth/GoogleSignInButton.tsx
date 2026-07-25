import * as WebBrowser from 'expo-web-browser';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';
import { useState } from 'react';

import { SecondaryButton } from '@/components/buttons';
import { AuthUserFacingError } from '@/services/auth';
import {
  getGoogleClientIdForCurrentPlatform,
  getGoogleClientIds,
} from '@/services/auth/googleConfig';

WebBrowser.maybeCompleteAuthSession();

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onCredential: (idToken: string, accessToken?: string) => Promise<void>;
  onError: (error: unknown) => void;
};

export function GoogleSignInButton({
  disabled = false,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const clientIds = getGoogleClientIds();
  const clientId = getGoogleClientIdForCurrentPlatform(clientIds);

  if (!clientId) {
    return (
      <SecondaryButton
        accessibilityHint="Configure o client ID do Google para esta plataforma"
        accessibilityLabel="Entrar com o Google indisponível"
        disabled
        fullWidth
        label="Entrar com o Google"
      />
    );
  }

  return (
    <ConfiguredGoogleSignInButton
      clientIds={clientIds}
      disabled={disabled}
      onCredential={onCredential}
      onError={onError}
    />
  );
}

type ConfiguredGoogleSignInButtonProps = GoogleSignInButtonProps & {
  clientIds: ReturnType<typeof getGoogleClientIds>;
};

function ConfiguredGoogleSignInButton({
  clientIds,
  disabled = false,
  onCredential,
  onError,
}: ConfiguredGoogleSignInButtonProps) {
  const [request, , promptAsync] = useIdTokenAuthRequest(
    {
      webClientId: clientIds.webClientId,
      iosClientId: clientIds.iosClientId,
      androidClientId: clientIds.androidClientId,
      selectAccount: true,
    },
    {
      native: 'pareact://oauthredirect',
      scheme: 'pareact',
    },
  );
  const [requesting, setRequesting] = useState(false);

  const handlePress = async () => {
    setRequesting(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success') {
        const idToken = result.params.id_token || result.authentication?.idToken;
        if (!idToken) {
          throw new AuthUserFacingError(
            'configuration',
            'Token do Google não retornado pelo provedor.',
          );
        }
        await onCredential(idToken, result.authentication?.accessToken);
        return;
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new AuthUserFacingError('cancelled', 'O login foi cancelado.');
      }

      throw new AuthUserFacingError('unknown', 'Falha na autenticação com o Google.');
    } catch (error) {
      onError(error);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <SecondaryButton
      accessibilityHint={
        Platform.OS === 'web'
          ? 'Abre a autenticação do Google no navegador'
          : 'Abre a autenticação do Google no navegador do sistema'
      }
      accessibilityLabel="Entrar com o Google"
      disabled={disabled || !request}
      fullWidth
      label="Entrar com o Google"
      loading={requesting}
      onPress={handlePress}
    />
  );
}
