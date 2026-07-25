import type { AuthRepository } from '@/repositories/auth';
import { firebaseAuthRepository } from '@/repositories/auth';
import { connectivityService } from '@/services/connectivity';

import { AuthUserFacingError, mapAuthError } from './AuthErrorMapper';
import type { AuthServiceContract, AuthStateListener, AuthUser } from './types';

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
      return await this.repository.signInWithEmailAndPassword(email.trim(), password);
    } catch (error) {
      throw error instanceof AuthUserFacingError ? error : mapAuthError(error, 'email');
    }
  }

  public async signInWithGooglePopup(): Promise<AuthUser> {
    try {
      return await this.repository.signInWithGooglePopup();
    } catch (error) {
      throw mapAuthError(error, 'google');
    }
  }

  public async signInWithGoogleCredential(
    idToken: string,
    accessToken?: string,
  ): Promise<AuthUser> {
    if (!idToken.trim()) {
      throw new AuthUserFacingError('configuration', 'Token do Google ausente.');
    }

    try {
      return await this.repository.signInWithGoogleCredential(idToken, accessToken);
    } catch (error) {
      throw mapAuthError(error, 'google');
    }
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
