import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseApp } from './app';

let firestore: Firestore | undefined;

export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
  }

  return firestore;
}
