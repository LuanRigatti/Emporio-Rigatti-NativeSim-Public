import { useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  GoogleSignInButton,
  InlineError,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PrimaryButton,
  Section,
} from '@/components';
import { useAuth } from '@/providers';
import {
  getGoogleClientIdForCurrentPlatform,
  getGoogleClientIds,
} from '@/services/auth/googleConfig';
import { useAppTheme } from '@/theme';

export function LoginScreen() {
  const { theme } = useAppTheme();
  const {
    error,
    isLoading,
    signIn,
    signInWithGoogleCredential,
    signInWithGooglePopup,
    clearError,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleError, setGoogleError] = useState<string | undefined>();
  const googleConfigured =
    Platform.OS === 'web' || Boolean(getGoogleClientIdForCurrentPlatform(getGoogleClientIds()));

  const handleSubmit = () => {
    Keyboard.dismiss();
    setGoogleError(undefined);
    clearError();
    void signIn(email, password).catch(() => undefined);
  };

  const handleGoogleCredential = async (idToken: string, accessToken?: string) => {
    setGoogleError(undefined);
    clearError();
    await signInWithGoogleCredential(idToken, accessToken);
  };

  const handleGoogleError = (authError: unknown) => {
    if (authError instanceof Error) {
      setGoogleError(authError.message);
    } else {
      setGoogleError('Falha na autenticação com o Google.');
    }
  };

  const visibleError = googleError ?? error ?? undefined;

  return (
    <KeyboardScreen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <LargeTitleHeader
            subtitle="Digite suas credenciais para sincronizar online"
            title="Acessar Sistema"
          />

          <Section style={{ marginTop: theme.spacing.xl }}>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              accessibilityHint="Informe o e-mail usado no Firebase"
              keyboardType="email-address"
              label="E-mail"
              onChangeText={setEmail}
              placeholder="Seu e-mail"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              accessibilityHint="Informe sua senha do Firebase"
              label="Senha"
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Sua senha"
              returnKeyType="done"
              secureTextEntry
              textContentType="password"
              value={password}
            />
            <PrimaryButton
              accessibilityHint="Autentica e sincroniza os dados da conta"
              accessibilityLabel="Entrar e sincronizar"
              fullWidth
              label="Entrar e Sincronizar"
              loading={isLoading}
              onPress={handleSubmit}
            />
          </Section>

          <View
            style={[
              styles.divider,
              {
                marginVertical: theme.spacing.lg,
              },
            ]}
          >
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.separator }]} />
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.textTertiary,
                  marginHorizontal: theme.spacing.sm,
                },
              ]}
            >
              ou
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.separator }]} />
          </View>

          <GoogleSignInButton
            disabled={isLoading}
            onPopup={signInWithGooglePopup}
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
          />
          {!googleConfigured ? (
            <InlineError message="Login Google indisponível: client ID não configurado para esta plataforma." />
          ) : null}
          <InlineError message={visibleError} />
        </View>
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
