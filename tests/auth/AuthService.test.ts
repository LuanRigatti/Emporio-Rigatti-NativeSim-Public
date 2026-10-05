import { AuthService } from '@/services/auth/AuthService';
import type { AuthRepository } from '@/repositories/auth';
import { getQuickLoginCredentials } from '@/config/quickLoginConfig';
import { connectivityService, type ConnectivityState } from '@/services/connectivity';
import type { AuthUser } from '@/services/auth/types';

jest.mock('@/config/quickLoginConfig', () => ({
  getQuickLoginCredentials: jest.fn(),
}));

jest.mock('@/repositories/auth', () => ({
  firebaseAuthRepository: {},
}));

const quickLoginCredentialsMock = jest.mocked(getQuickLoginCredentials);

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
    return this.emailSignIn(email, password).then((user) => {
      this.currentUser = user;
      return user;
    });
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

  public async signOut(): Promise<void> {
    await this.signOutCall();
    this.currentUser = null;
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

const fixedQuickLoginUser: AuthUser = {
  id: 'fixed-test-account-uid',
  email: 'quick-test@example.com',
  displayName: 'Conta de teste',
  photoUrl: null,
  phoneNumber: null,
};

const fixedQuickLoginCredentials = {
  email: 'quick-test@example.com',
  password: 'test-account-password',
};

const connectedState: ConnectivityState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi' as ConnectivityState['type'],
};

describe('AuthService', () => {
  let connectivitySpy: jest.SpiedFunction<typeof connectivityService.getCurrentState>;

  beforeEach(() => {
    quickLoginCredentialsMock.mockReturnValue(fixedQuickLoginCredentials);
    connectivitySpy = jest
      .spyOn(connectivityService, 'getCurrentState')
      .mockResolvedValue(connectedState);
  });

  afterEach(() => {
    connectivitySpy.mockRestore();
    quickLoginCredentialsMock.mockReset();
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
  });

  it('uses the Firebase popup for Web Google login', async () => {
    const repository = new FakeAuthRepository();
    const popup = jest.fn<Promise<AuthUser>, []>().mockResolvedValue(authorizedGoogleUser);
    repository.signInWithGooglePopup = popup;
    const service = new AuthService(repository);

    await expect(service.signInWithGooglePopup()).resolves.toEqual(authorizedGoogleUser);
    expect(popup).toHaveBeenCalledTimes(1);
  });

  it('uses the configured fixed Firebase account through ordinary email/password auth', async () => {
    const repository = new FakeAuthRepository();
    repository.emailSignIn.mockResolvedValue(fixedQuickLoginUser);
    const service = new AuthService(repository);

    await expect(service.signInWithQuickLogin()).resolves.toEqual(fixedQuickLoginUser);
    expect(repository.emailSignIn).toHaveBeenCalledWith(
      fixedQuickLoginCredentials.email,
      fixedQuickLoginCredentials.password,
    );
    expect(repository.googleSignIn).not.toHaveBeenCalled();
    expect(repository.signOutCall).not.toHaveBeenCalled();
  });

  it('uses the same configured Firebase UID after logout and a second quick login', async () => {
    const repository = new FakeAuthRepository();
    repository.emailSignIn.mockResolvedValue(fixedQuickLoginUser);
    const service = new AuthService(repository);

    const firstUser = await service.signInWithQuickLogin();
    await service.signOut();
    const secondUser = await service.signInWithQuickLogin();

    expect(secondUser.id).toBe(firstUser.id);
    expect(repository.emailSignIn).toHaveBeenNthCalledWith(
      1,
      fixedQuickLoginCredentials.email,
      fixedQuickLoginCredentials.password,
    );
    expect(repository.emailSignIn).toHaveBeenNthCalledWith(
      2,
      fixedQuickLoginCredentials.email,
      fixedQuickLoginCredentials.password,
    );
  });

  it('does not replace an already authenticated Google account', async () => {
    const repository = new FakeAuthRepository();
    repository.currentUser = authorizedGoogleUser;
    const service = new AuthService(repository);

    await expect(service.signInWithQuickLogin()).rejects.toMatchObject({
      code: 'configuration',
      message: 'Saia da conta atual antes de usar Entrada rápida.',
    });
    expect(repository.emailSignIn).not.toHaveBeenCalled();
    expect(repository.signOutCall).not.toHaveBeenCalled();
  });

  it('fails with setup guidance when the fixed account credentials are missing', async () => {
    quickLoginCredentialsMock.mockReturnValue(null);
    const repository = new FakeAuthRepository();
    const service = new AuthService(repository);

    await expect(service.signInWithQuickLogin()).rejects.toMatchObject({
      code: 'configuration',
      message: expect.stringContaining('EXPO_PUBLIC_QUICK_LOGIN_EMAIL'),
    });
    expect(repository.emailSignIn).not.toHaveBeenCalled();
  });

  it('rejects a Google account that is not the authorized account', async () => {
    const repository = new FakeAuthRepository();
    repository.googleSignIn.mockResolvedValue(authenticatedUser);
    const service = new AuthService(repository);

    await expect(service.signInWithGoogleCredential('id-token')).rejects.toMatchObject({
      code: 'account-not-authorized',
    });
    expect(repository.signOutCall).toHaveBeenCalledTimes(1);
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
