type ErrorRecord = { code?: unknown; message?: unknown };

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'network'
  | 'cancelled'
  | 'popup-blocked'
  | 'configuration'
  | 'account-not-authorized'
  | 'unknown';

export class AuthUserFacingError extends Error {
  public readonly code: AuthErrorCode;
  public readonly causeValue: unknown;

  public constructor(code: AuthErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'AuthUserFacingError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

function readError(error: unknown): ErrorRecord {
  if (typeof error !== 'object' || error === null) return {};
  const record = error as Record<string, unknown>;
  return { code: record.code, message: record.message };
}

function readCode(error: unknown): string {
  const code = readError(error).code;
  return typeof code === 'string' ? code : '';
}

function readMessage(error: unknown): string {
  const message = readError(error).message;
  return typeof message === 'string' ? message : '';
}

function isNetworkError(code: string, message: string): boolean {
  return (
    code === 'auth/network-request-failed' ||
    code === 'auth/internal-error' ||
    message.toLowerCase().includes('network')
  );
}

export function mapAuthError(
  error: unknown,
  operation: 'email' | 'google' | 'session' | 'logout' | 'profile',
): AuthUserFacingError {
  const code = readCode(error);
  const message = readMessage(error);

  if (message.includes('Firebase configuration is incomplete')) {
    return new AuthUserFacingError(
      'configuration',
      'Configuracao do Firebase incompleta. Verifique o arquivo de ambiente.',
      error,
    );
  }

  if (isNetworkError(code, message)) {
    return new AuthUserFacingError(
      'network',
      'Aguardando conexão com o servidor... Tente novamente.',
      error,
    );
  }

  if (
    operation === 'email' &&
    [
      'auth/invalid-credential',
      'auth/invalid-email',
      'auth/user-not-found',
      'auth/wrong-password',
    ].includes(code)
  ) {
    return new AuthUserFacingError(
      'invalid-credentials',
      'Erro ao acessar: Verifique seu e-mail e senha.',
      error,
    );
  }

  if (
    operation === 'google' &&
    (code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      message.includes('canceled') ||
      message.includes('cancelled') ||
      message.includes('closed') ||
      message.includes('12501'))
  ) {
    return new AuthUserFacingError('cancelled', 'O login foi cancelado.', error);
  }

  if (operation === 'google' && code === 'auth/popup-blocked') {
    return new AuthUserFacingError(
      'popup-blocked',
      'Pop-up bloqueado pelo navegador. Por favor, permita pop-ups.',
      error,
    );
  }

  if (operation === 'google' && code === 'auth/missing-or-invalid-nonce') {
    return new AuthUserFacingError(
      'configuration',
      'Não foi possível validar a resposta do Google.',
      error,
    );
  }

  if (operation === 'session') {
    return new AuthUserFacingError(
      'network',
      'Aguardando conexão com o servidor... Tente novamente.',
      error,
    );
  }

  if (operation === 'google') {
    return new AuthUserFacingError(
      'unknown',
      'Erro ao acessar com o Google: ' + (message || 'Falha na autenticação.'),
      error,
    );
  }

  return new AuthUserFacingError(
    'unknown',
    operation === 'logout'
      ? 'Não foi possível sair da conta.'
      : operation === 'profile'
        ? 'Não foi possível atualizar o nome.'
        : 'Não foi possível autenticar.',
    error,
  );
}
