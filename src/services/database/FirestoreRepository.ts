import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';

import { getFirebaseFirestore } from '@/services/firebase';

import { assertFirestoreUid } from './firestorePaths';

export type EntityWithId<T> = T & { id: string };

export class FirestoreRepository<T extends DocumentData> {
  public constructor(
    private readonly uid: string,
    private readonly collectionName: string,
  ) {
    assertFirestoreUid(uid);
    if (!collectionName.trim() || collectionName.includes('/')) {
      throw new Error('A coleção Firestore é inválida.');
    }
  }

  protected get collectionRef(): CollectionReference<T> {
    return collection(
      getFirebaseFirestore(),
      'users',
      this.uid,
      this.collectionName,
    ) as CollectionReference<T>;
  }

  protected documentRef(id: string) {
    if (!id.trim() || id.includes('/')) {
      throw new Error('O ID do documento Firestore é inválido.');
    }
    return doc(this.collectionRef, id);
  }

  async findById(id: string): Promise<EntityWithId<T> | null> {
    const snapshot = await getDoc(this.documentRef(id));

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...snapshot.data() };
  }

  async create(data: T): Promise<EntityWithId<T>> {
    const reference = doc(this.collectionRef);
    await setDoc(reference, data);
    return { id: reference.id, ...data };
  }

  async set(id: string, data: T): Promise<void> {
    await setDoc(this.documentRef(id), data);
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await updateDoc(this.documentRef(id), data as UpdateData<T>);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(this.documentRef(id));
  }
}
