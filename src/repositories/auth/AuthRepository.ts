import type { AuthUser } from '@/services/auth/types';

export interface AuthRepository {
  getCurrentUser(): AuthUser | null;
  subscribe(
    listener: (user: AuthUser | null) => void,
    onError?: (error: unknown) => void,
  ): () => void;
  signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser>;
  signInWithGooglePopup(): Promise<AuthUser>;
  signInWithGoogleCredential(idToken: string, accessToken?: string): Promise<AuthUser>;
  updateDisplayName(displayName: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}
