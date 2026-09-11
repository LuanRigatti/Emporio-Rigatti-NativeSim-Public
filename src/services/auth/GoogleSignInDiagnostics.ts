import type { GoogleSignInDiagnosticStage } from './AuthErrorMapper';

type ErrorRecord = {
  code?: unknown;
  message?: unknown;
  causeValue?: unknown;
  originalError?: unknown;
  diagnosticStage?: unknown;
};

export type GoogleSignInDiagnostic = {
  stage: GoogleSignInDiagnosticStage | 'etapa não identificada';
  code?: string;
  message: string;
};

const TOKEN_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /((?:id|access|refresh)[_-]?token|client[_-]?secret|api[_-]?key|secret|password)\s*[:=]\s*(['"]?)[^,\s'"}&]+/gi;

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === 'object' && value !== null;
}

function isDiagnosticStage(value: unknown): value is GoogleSignInDiagnosticStage {
  return (
    value === 'GoogleSignin.configure' ||
    value === 'GoogleSignin.signIn' ||
    value === 'obtenção do idToken' ||
    value === 'GoogleAuthProvider.credential' ||
    value === 'Firebase signInWithCredential' ||
    value === 'validação do e-mail autorizado'
  );
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.code === 'string' && error.code.length <= 120) {
    return error.code;
  }

  if (typeof error.code === 'number' && Number.isFinite(error.code)) {
    return String(error.code);
  }

  return undefined;
}

function readErrorMessage(error: unknown): string {
  if (!isRecord(error) || typeof error.message !== 'string') {
    return 'Falha sem mensagem retornada.';
  }

  return error.message;
}

export function sanitizeGoogleSignInDiagnosticText(value: string): string {
  return value
    .replace(TOKEN_PATTERN, '[token redigido]')
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1[valor redigido]')
    .slice(0, 500);
}

export class GoogleSignInDiagnosticError extends Error {
  public readonly causeValue: unknown;
  public readonly code?: string;
  public readonly diagnosticStage: GoogleSignInDiagnosticStage;

  public constructor(stage: GoogleSignInDiagnosticStage, causeValue: unknown) {
    const message = sanitizeGoogleSignInDiagnosticText(readErrorMessage(causeValue));
    super(message);
    this.name = 'GoogleSignInDiagnosticError';
    this.causeValue = causeValue;
    this.code = readErrorCode(causeValue);
    this.diagnosticStage = stage;
  }
}

export function readGoogleSignInDiagnostic(error: unknown): GoogleSignInDiagnostic {
  const visited = new Set<object>();
  let current: unknown = error;
  let fallbackCode = readErrorCode(error);
  let fallbackMessage = sanitizeGoogleSignInDiagnosticText(readErrorMessage(error));

  while (isRecord(current) && !visited.has(current)) {
    visited.add(current);

    if (isDiagnosticStage(current.diagnosticStage)) {
      let source: unknown = current;
      let nested: unknown = current.causeValue ?? current.originalError;

      while (isRecord(nested) && isDiagnosticStage(nested.diagnosticStage)) {
        source = nested;
        nested = nested.causeValue ?? nested.originalError;
      }

      return {
        code: readErrorCode(source) ?? fallbackCode,
        message: sanitizeGoogleSignInDiagnosticText(readErrorMessage(source)),
        stage: current.diagnosticStage,
      };
    }

    fallbackCode = fallbackCode ?? readErrorCode(current);
    if (fallbackMessage === 'Falha sem mensagem retornada.') {
      fallbackMessage = sanitizeGoogleSignInDiagnosticText(readErrorMessage(current));
    }
    current = current.causeValue ?? current.originalError;
  }

  return {
    code: fallbackCode,
    message: fallbackMessage,
    stage: 'etapa não identificada',
  };
}
