import { firestoreUserCollectionPath, firestoreUserPath } from '@/services/database/firestorePaths';
import { buildFirestoreUserRootDocument } from '@/services/database/firestoreUser';

jest.mock('firebase/firestore', () => ({
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
}));

describe('Firestore foundation', () => {
  it('scopes every future user path below users/{uid}', () => {
    expect(firestoreUserPath('firebase-user')).toBe('users/firebase-user');
    expect(firestoreUserCollectionPath('firebase-user', 'clients')).toBe(
      'users/firebase-user/clients',
    );
  });

  it('rejects mock or malformed UIDs before building a path', () => {
    expect(() => firestoreUserPath('')).toThrow();
    expect(() => firestoreUserPath('mock-user-1')).toThrow();
    expect(() => firestoreUserCollectionPath('firebase-user', '')).toThrow();
  });

  it('defines the root schema without writing or initializing Firebase data', () => {
    const root = buildFirestoreUserRootDocument();

    expect(root.schemaVersion).toBe(1);
    expect(root.createdAt).toBeDefined();
    expect(root.updatedAt).toBeDefined();
  });
});
