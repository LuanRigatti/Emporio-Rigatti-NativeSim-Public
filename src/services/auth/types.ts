import type { User } from '@/types/data';

export type AuthUser = User;

export type AuthStateListener = (user: AuthUser | null) => void;

export interface AuthServiceContract {
  getCurrentUser(): AuthUser | null;
  subscribe(listener: AuthStateListener, onError?: (error: unknown) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signInWithGoogleNative(): Promise<AuthUser>;
  signInWithGooglePopup(): Promise<AuthUser>;
  signInWithGoogleCredential(idToken: string, accessToken?: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}

export interface AuthDataSource extends AuthServiceContract {
  restore?(): Promise<void>;
}
