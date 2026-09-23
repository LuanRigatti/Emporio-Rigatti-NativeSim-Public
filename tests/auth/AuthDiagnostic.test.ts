import {
  createAuthDiagnostic,
  getAuthDiagnosticEvents,
  recordAuthDiagnosticEvent,
  resetAuthDiagnosticEvents,
} from '@/services/auth/AuthDiagnostic';

describe('AuthDiagnostic', () => {
  beforeEach(() => {
    resetAuthDiagnosticEvents();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('identifies an auth error without exposing tokens, email or uid', () => {
    const diagnostic = createAuthDiagnostic('firebase:signin', {
      code: 'auth/invalid-credential',
      message:
        'idToken=eyJheader.payload.signature user=test-user@example.test uid=uid-alphanumeric-123',
    });

    expect(diagnostic.code).toBe('auth-invalid-credential');
    expect(diagnostic.message).not.toContain('eyJheader');
    expect(diagnostic.message).not.toContain('test-user@example.test');
    expect(diagnostic.message).not.toContain('uid-alphanumeric-123');
    expect(diagnostic.events).toContain('auth:error:auth-invalid-credential');
  });

  it('keeps allowlist and Firebase stages distinguishable', () => {
    recordAuthDiagnosticEvent('firebase:signin-start');
    recordAuthDiagnosticEvent('firebase:signin-success');
    recordAuthDiagnosticEvent('allowlist:denied');

    expect(getAuthDiagnosticEvents()).toEqual([
      'firebase:signin-start',
      'firebase:signin-success',
      'allowlist:denied',
    ]);
  });

  it('records the persistence fallback without recording the exception contents', () => {
    recordAuthDiagnosticEvent('auth:init:fallback-getAuth', 'auth/already-initialized');

    expect(getAuthDiagnosticEvents()).toEqual([
      'auth:init:fallback-getAuth:auth-already-initialized',
    ]);
    expect(getAuthDiagnosticEvents().join(' ')).not.toContain('credential');
  });
});
