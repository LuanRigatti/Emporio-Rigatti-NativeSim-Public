export const FIRESTORE_ROOT_COLLECTION = 'users' as const;

export function assertFirestoreUid(uid: string): void {
  if (!uid.trim() || uid === 'mock-user-1') {
    throw new Error('UID Firebase válido é obrigatório.');
  }
}

export function firestoreUserPath(uid: string): string {
  assertFirestoreUid(uid);
  return `${FIRESTORE_ROOT_COLLECTION}/${uid}`;
}

export function firestoreUserCollectionPath(uid: string, collectionName: string): string {
  if (!collectionName.trim() || collectionName.includes('/')) {
    throw new Error('O nome da coleção Firestore é inválido.');
  }
  return `${firestoreUserPath(uid)}/${collectionName}`;
}
