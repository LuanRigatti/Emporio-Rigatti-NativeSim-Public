jest.mock('@/repositories/auth', () => ({
  firebaseAuthRepository: {},
}));

import { AuthService } from '@/services/auth/AuthService';
import { getAuthDiagnosticEvents, resetAuthDiagnosticEvents } from '@/services/auth/AuthDiagnostic';
import type { AuthRepository } from '@/repositories/auth';
import { connectivityService, type ConnectivityState } from '@/services/connectivity';
import type { AuthUser } from '@/services/auth/types';

class FakeAuthRepository implements AuthRepository {
  public currentUser: AuthUser | null = null;
  public readonly emailSignIn = jest.fn<Promise<AuthUser>, [email: string, password: string]>();
  public readonly googleSignIn = jest.fn<
    Promise<AuthUser>,
    [idToken: string, accessToken?: string]
  >();
  public readonly signOutCall = jest.fn<Promise<void>, []>();

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public subscribe(): () => void {
    return () => undefined;
  }

  public signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
    return this.emailSignIn(email, password);
  }

  public signInWithGooglePopup(): Promise<AuthUser> {
    return Promise.reject(new Error('Popup não usado neste teste.'));
  }

  public signInWithGoogleCredential(idToken: string, accessToken?: string): Promise<AuthUser> {
    return this.googleSignIn(idToken, accessToken);
  }

  public updateDisplayName(displayName: string): Promise<AuthUser> {
    return Promise.resolve({ ...authenticatedUser, displayName });
  }

  public signOut(): Promise<void> {
    return this.signOutCall();
  }
}

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'cliente@example.com',
  displayName: 'Cliente',
  photoUrl: null,
  phoneNumber: null,
};

const authorizedGoogleUser: AuthUser = {
  ...authenticatedUser,
  id: 'google-user-1',
  email: 'luanr.rigatti@gmail.com',
};

const connectedState: ConnectivityState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi' as ConnectivityState['type'],
};

describe('AuthService', () => {
  let connectivitySpy: jest.SpiedFunction<typeof connectivityService.getCurrentState>;

  beforeEach(() => {
    resetAuthDiagnosticEvents();
    connectivitySpy = jest
      .spyOn(connectivityService, 'getCurrentState')
      .mockResolvedValue(connectedState);
  });

  afterEach(() => {
    connectivitySpy.mockRestore();
  });

  it('signs in with trimmed email and password', async () => {
    const repository = new FakeAuthRepository();
    repository.emailSignIn.mockResolvedValue(authenticatedUser);
    const service = new AuthService(repository);

    await expect(service.signIn(' cliente@example.com ', 'senha')).resolves.toEqual(
      authenticatedUser,
    );
    expect(repository.emailSignIn).toHaveBeenCalledWith('cliente@example.com', 'senha');
  });

  it('returns the original invalid-credentials contract for wrong passwords', async () => {
    const repository = new FakeAuthRepository();
    repository.emailSignIn.mockRejectedValue({ code: 'auth/wrong-password' });
    const service = new AuthService(repository);

    await expect(service.signIn('cliente@example.com', 'errada')).rejects.toMatchObject({
      code: 'invalid-credentials',
      message: 'Erro ao acessar: Verifique seu e-mail e senha.',
    });
  });

  it('uses the same safe message when the user does not exist', async () => {
    const repository = new FakeAuthRepository();
    repository.emailSignIn.mockRejectedValue({ code: 'auth/user-not-found' });
    const service = new AuthService(repository);

    await expect(service.signIn('inexistente@example.com', 'senha')).rejects.toMatchObject({
      code: 'invalid-credentials',
      message: 'Erro ao acessar: Verifique seu e-mail e senha.',
    });
  });

  it('does not call Firebase while the device is offline', async () => {
    connectivitySpy.mockResolvedValue({ ...connectedState, isConnected: false });
    const repository = new FakeAuthRepository();
    const service = new AuthService(repository);

    await expect(service.signIn('cliente@example.com', 'senha')).rejects.toMatchObject({
      code: 'network',
      message: 'Aguardando conexão com o servidor... Tente novamente.',
    });
    expect(repository.emailSignIn).not.toHaveBeenCalled();
  });

  it('signs in with the Google credential produced by AuthSession', async () => {
    const repository = new FakeAuthRepository();
    repository.googleSignIn.mockResolvedValue(authorizedGoogleUser);
    const service = new AuthService(repository);

    await expect(service.signInWithGoogleCredential('id-token', 'access-token')).resolves.toEqual(
      authorizedGoogleUser,
    );
    expect(repository.googleSignIn).toHaveBeenCalledWith('id-token', 'access-token');
    expect(getAuthDiagnosticEvents()).toEqual([
      'firebase:signin-start',
      'firebase:signin-success',
      'allowlist:allowed',
    ]);
  });

  it('uses the Firebase popup for Web Google login', async () => {
    const repository = new FakeAuthRepository();
    const popup = jest.fn<Promise<AuthUser>, []>().mockResolvedValue(authorizedGoogleUser);
    repository.signInWithGooglePopup = popup;
    const service = new AuthService(repository);

    await expect(service.signInWithGooglePopup()).resolves.toEqual(authorizedGoogleUser);
    expect(popup).toHaveBeenCalledTimes(1);
  });

  it('rejects a Google account that is not the authorized account', async () => {
    const repository = new FakeAuthRepository();
    repository.googleSignIn.mockResolvedValue(authenticatedUser);
    const service = new AuthService(repository);

    await expect(service.signInWithGoogleCredential('id-token')).rejects.toMatchObject({
      code: 'account-not-authorized',
    });
    expect(repository.signOutCall).toHaveBeenCalledTimes(1);
    expect(getAuthDiagnosticEvents()).toEqual([
      'firebase:signin-start',
      'firebase:signin-success',
      'allowlist:denied',
    ]);
  });

  it('reads the restored session exposed by Firebase persistence', () => {
    const repository = new FakeAuthRepository();
    repository.currentUser = authenticatedUser;
    const service = new AuthService(repository);

    expect(service.getCurrentUser()).toEqual(authenticatedUser);
  });

  it('logs out through the repository', async () => {
    const repository = new FakeAuthRepository();
    repository.signOutCall.mockResolvedValue(undefined);
    const service = new AuthService(repository);

    await expect(service.signOut()).resolves.toBeUndefined();
    expect(repository.signOutCall).toHaveBeenCalledTimes(1);
  });
});
