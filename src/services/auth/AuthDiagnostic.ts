export type AuthDiagnosticSnapshot = {
  stage: string;
  code: string;
  message: string;
  events: readonly string[];
};

const MAX_EVENTS = 12;
const diagnosticEvents: string[] = [];

function readErrorField(error: unknown, field: 'code' | 'message'): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function sanitizeText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[redacted-token]')
    .replace(
      /\b(?:api[_ -]?key|access[_ -]?token|id[_ -]?token|client[_ -]?secret|password|credential)\s*[:=]\s*[^\s,;]+/gi,
      '[redacted-secret]',
    )
    .replace(/\b(?:uid|user[_ -]?id)\s*[:=]\s*[^\s,;]+/gi, '[redacted-uid]')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      '[redacted-id]',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function sanitizeAuthDiagnosticCode(error: unknown, fallback = 'unknown'): string {
  const rawCode = readErrorField(error, 'code') ?? fallback;
  const sanitizedCode = rawCode
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 64);

  return sanitizedCode || fallback;
}

export function recordAuthDiagnosticEvent(event: string, detail?: string): void {
  const safeEvent = event.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 80);
  const safeDetail = detail ? sanitizeText(detail).replace(/[^a-zA-Z0-9_.=:-]/g, '-') : '';
  const entry = safeDetail ? `${safeEvent}:${safeDetail}` : safeEvent;

  diagnosticEvents.push(entry);
  if (diagnosticEvents.length > MAX_EVENTS) diagnosticEvents.shift();

  console.info(`[AuthDiagnostic] ${entry}`);
}

export function getAuthDiagnosticEvents(): readonly string[] {
  return [...diagnosticEvents];
}

export function getAuthDiagnosticStage(fallback = 'auth', startIndex = 0): string {
  let passiveStage: string | null = null;

  for (const event of diagnosticEvents.slice(startIndex).reverse()) {
    if (event.startsWith('google:')) return 'google';
    if (event.startsWith('firebase:signin')) return 'firebase:signin';
    if (event.startsWith('allowlist:')) return 'allowlist';
    if (event.startsWith('auth:init:')) return 'auth:init';
    if (event.startsWith('auth-state:') && !passiveStage) passiveStage = 'auth-state';
  }

  return passiveStage ?? fallback;
}

export function createAuthDiagnostic(
  stage: string,
  error: unknown,
  fallbackCode = 'unknown',
  fallbackMessage = 'Falha sanitizada durante a autenticação.',
): AuthDiagnosticSnapshot {
  const code = sanitizeAuthDiagnosticCode(error, fallbackCode);
  const rawMessage = readErrorField(error, 'message');
  const message = rawMessage ? sanitizeText(rawMessage) || fallbackMessage : fallbackMessage;

  recordAuthDiagnosticEvent(`auth:error:${code}`);

  return {
    code,
    events: getAuthDiagnosticEvents(),
    message,
    stage,
  };
}

export function resetAuthDiagnosticEvents(): void {
  diagnosticEvents.length = 0;
}
