import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

import { getFirebaseAuth } from '@/services/firebase';
import type { AuthUser } from '@/services/auth/types';

import type { AuthRepository } from './AuthRepository';

function mapUser(user: FirebaseUser | null): AuthUser | null {
  if (!user) return null;

  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
    phoneNumber: user.phoneNumber,
  };
}

export class FirebaseAuthRepository implements AuthRepository {
  private readonly authFactory: () => Auth;

  public constructor(authFactory: () => Auth = getFirebaseAuth) {
    this.authFactory = authFactory;
  }

  private get auth(): Auth {
    return this.authFactory();
  }

  public getCurrentUser(): AuthUser | null {
    return mapUser(this.auth.currentUser);
  }

  public subscribe(
    listener: (user: AuthUser | null) => void,
    onError?: (error: unknown) => void,
  ): () => void {
    return onAuthStateChanged(
      this.auth,
      (user) => listener(mapUser(user)),
      (error) => onError?.(error),
    );
  }

  public async signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return mapUser(result.user) as AuthUser;
  }

  public async signInWithGooglePopup(): Promise<AuthUser> {
    const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
    return mapUser(result.user) as AuthUser;
  }

  public async signInWithGoogleCredential(
    idToken: string,
    accessToken?: string,
  ): Promise<AuthUser> {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(this.auth, credential);
    return mapUser(result.user) as AuthUser;
  }

  public async updateDisplayName(displayName: string): Promise<AuthUser> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Nenhuma sessão autenticada.');

    await updateProfile(user, { displayName });
    return mapUser(user) as AuthUser;
  }

  public async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}

export const firebaseAuthRepository = new FirebaseAuthRepository();
