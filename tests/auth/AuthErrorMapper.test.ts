import { AuthUserFacingError, mapAuthError } from '@/services/auth/AuthErrorMapper';

describe('mapAuthError', () => {
  it('preserves the Ionic email error message for invalid credentials', () => {
    const result = mapAuthError({ code: 'auth/wrong-password' }, 'email');

    expect(result).toBeInstanceOf(AuthUserFacingError);
    expect(result.code).toBe('invalid-credentials');
    expect(result.message).toBe('Erro ao acessar: Verifique seu e-mail e senha.');
  });

  it('maps network failures to a retryable connection message', () => {
    const result = mapAuthError({ code: 'auth/network-request-failed' }, 'email');

    expect(result.code).toBe('network');
    expect(result.message).toBe('Aguardando conexão com o servidor... Tente novamente.');
  });

  it('maps Google cancellation without exposing a provider error', () => {
    const result = mapAuthError({ code: 'auth/popup-closed-by-user' }, 'google');

    expect(result.code).toBe('cancelled');
    expect(result.message).toBe('O login foi cancelado.');
  });

  it('keeps the popup blocked guidance for Web', () => {
    const result = mapAuthError({ code: 'auth/popup-blocked' }, 'google');

    expect(result.code).toBe('popup-blocked');
    expect(result.message).toBe('Pop-up bloqueado pelo navegador. Por favor, permita pop-ups.');
  });

  it('exposes missing Firebase configuration instead of masking it as a network issue', () => {
    const result = mapAuthError(
      { message: 'Firebase configuration is incomplete. Missing environment variables.' },
      'session',
    );

    expect(result.code).toBe('configuration');
    expect(result.message).toBe(
      'Configuracao do Firebase incompleta. Verifique o arquivo de ambiente.',
    );
  });

  it('explains when Email/Password is disabled for quick login', () => {
    const result = mapAuthError({ code: 'auth/operation-not-allowed' }, 'quick-login');

    expect(result.code).toBe('configuration');
    expect(result.message).toContain('Ative Email/Password no Firebase Console.');
  });

  it('does not expose Firebase credential details for quick login failures', () => {
    const result = mapAuthError(
      { code: 'auth/invalid-credential', message: 'private provider detail' },
      'quick-login',
    );

    expect(result.code).toBe('invalid-credentials');
    expect(result.message).toContain('conta de teste');
    expect(result.message).not.toContain('private provider detail');
  });
});
