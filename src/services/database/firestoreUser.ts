import { serverTimestamp, type FieldValue } from 'firebase/firestore';

export interface FirestoreUserRootDocument {
  schemaVersion: 1;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

/**
 * Builds the root document for a new user. This is intentionally not called
 * during app startup; the first domain write will decide when to create it.
 */
export function buildFirestoreUserRootDocument(): FirestoreUserRootDocument {
  return {
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}
