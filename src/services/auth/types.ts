export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
};

export type AuthStateListener = (user: AuthUser | null) => void;

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  subscribe(listener: AuthStateListener): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  register(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}
