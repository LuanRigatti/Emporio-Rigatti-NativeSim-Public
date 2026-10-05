import type { Auth, User, UserCredential } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { FirebaseAuthRepository } from '@/repositories/auth/FirebaseAuthRepository';

const mockCurrentUser: { value: Partial<User> | null } = { value: null };
const mockAuth = {
  get currentUser() {
    return mockCurrentUser.value;
  },
} as unknown as Auth;

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  onAuthStateChanged: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: () => mockAuth,
}));

const signInWithEmailAndPasswordMock = jest.mocked(signInWithEmailAndPassword);

describe('FirebaseAuthRepository email/password sign-in', () => {
  beforeEach(() => {
    mockCurrentUser.value = null;
    signInWithEmailAndPasswordMock.mockReset();
  });

  it('uses the primary Firebase Auth instance and returns the ordinary Firebase UID', async () => {
    const firebaseUser = {
      uid: 'fixed-test-account-uid',
      email: 'quick-test@example.com',
      displayName: 'Conta de teste',
      photoURL: null,
      phoneNumber: null,
    } as User;
    signInWithEmailAndPasswordMock.mockResolvedValue({ user: firebaseUser } as UserCredential);
    const repository = new FirebaseAuthRepository(() => mockAuth);

    await expect(
      repository.signInWithEmailAndPassword('quick-test@example.com', 'configured-password'),
    ).resolves.toEqual({
      id: 'fixed-test-account-uid',
      email: 'quick-test@example.com',
      displayName: 'Conta de teste',
      photoUrl: null,
      phoneNumber: null,
    });
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      mockAuth,
      'quick-test@example.com',
      'configured-password',
    );
  });
});
