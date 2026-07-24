import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from '@/services/firebase';

import type { AuthService, AuthStateListener, AuthUser } from './types';

function mapUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
    phoneNumber: user.phoneNumber,
  };
}

export class FirebaseAuthService implements AuthService {
  getCurrentUser(): AuthUser | null {
    return mapUser(getFirebaseAuth().currentUser);
  }

  subscribe(listener: AuthStateListener): () => void {
    return onAuthStateChanged(getFirebaseAuth(), (user) => listener(mapUser(user)));
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return mapUser(result.user) as AuthUser;
  }

  async register(email: string, password: string): Promise<AuthUser> {
    const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    return mapUser(result.user) as AuthUser;
  }

  async signOut(): Promise<void> {
    await signOut(getFirebaseAuth());
  }
}
