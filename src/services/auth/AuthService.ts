import type { AuthRepository } from '@/repositories/auth';
import { firebaseAuthRepository } from '@/repositories/auth';
import { connectivityService } from '@/services/connectivity';

import { AuthUserFacingError, mapAuthError } from './AuthErrorMapper';
import type { AuthServiceContract, AuthStateListener, AuthUser } from './types';

const AUTHORIZED_GOOGLE_EMAIL = 'luanr.rigatti@gmail.com';

export class AuthService implements AuthServiceContract {
  public constructor(private readonly repository: AuthRepository = firebaseAuthRepository) {}

  public getCurrentUser(): AuthUser | null {
    try {
      return this.repository.getCurrentUser();
    } catch (error) {
      throw mapAuthError(error, 'session');
    }
  }

  public subscribe(listener: AuthStateListener, onError?: (error: unknown) => void): () => void {
    try {
      return this.repository.subscribe(listener, (error) => {
        onError?.(mapAuthError(error, 'session'));
      });
    } catch (error) {
      onError?.(mapAuthError(error, 'session'));
      return () => undefined;
    }
  }

  public async signIn(email: string, password: string): Promise<AuthUser> {
    if (!email.trim() || !password) {
      throw new AuthUserFacingError('invalid-credentials', 'Por favor, preencha todos os campos.');
    }

    try {
      const connectivity = await connectivityService.getCurrentState();
      if (connectivity.isConnected === false) {
        throw new AuthUserFacingError(
          'network',
          'Aguardando conexão com o servidor... Tente novamente.',
        );
      }
      const user = await this.repository.signInWithEmailAndPassword(email.trim(), password);
      return user;
    } catch (error) {
      throw error instanceof AuthUserFacingError ? error : mapAuthError(error, 'email');
    }
  }

  public async signInWithGooglePopup(): Promise<AuthUser> {
    try {
      const user = await this.repository.signInWithGooglePopup();
      return this.validateGoogleUser(user);
    } catch (error) {
      throw error instanceof AuthUserFacingError ? error : mapAuthError(error, 'google');
    }
  }

  public async signInWithGoogleNative(): Promise<AuthUser> {
    return this.signInWithGooglePopup();
  }

  public async signInWithGoogleCredential(
    idToken: string,
    accessToken?: string,
  ): Promise<AuthUser> {
    if (!idToken.trim()) {
      throw new AuthUserFacingError('configuration', 'Token do Google ausente.');
    }

    try {
      const user = await this.repository.signInWithGoogleCredential(idToken, accessToken);
      return this.validateGoogleUser(user);
    } catch (error) {
      throw error instanceof AuthUserFacingError ? error : mapAuthError(error, 'google');
    }
  }

  public async updateDisplayName(displayName: string): Promise<AuthUser> {
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      throw new AuthUserFacingError('unknown', 'Informe um nome para continuar.');
    }

    try {
      return await this.repository.updateDisplayName(normalizedDisplayName);
    } catch (error) {
      throw mapAuthError(error, 'profile');
    }
  }

  private async validateGoogleUser(user: AuthUser): Promise<AuthUser> {
    const email = user.email?.trim().toLowerCase();
    if (email !== AUTHORIZED_GOOGLE_EMAIL) {
      await Promise.resolve(this.repository.signOut()).catch(() => undefined);
      throw new AuthUserFacingError(
        'account-not-authorized',
        `Use a conta Google autorizada: ${AUTHORIZED_GOOGLE_EMAIL}.`,
      );
    }

    return user;
  }

  public async signOut(): Promise<void> {
    try {
      await this.repository.signOut();
    } catch (error) {
      throw mapAuthError(error, 'logout');
    }
  }
}

export const authService = new AuthService();
