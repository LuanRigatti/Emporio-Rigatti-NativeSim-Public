import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';

import { getFirebaseFirestore } from '@/services/firebase';

export type EntityWithId<T> = T & { id: string };

export class FirestoreRepository<T extends DocumentData> {
  public constructor(private readonly collectionName: string) {}

  private get collectionRef(): CollectionReference<T> {
    return collection(getFirebaseFirestore(), this.collectionName) as CollectionReference<T>;
  }

  async findById(id: string): Promise<EntityWithId<T> | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id));

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...snapshot.data() };
  }

  async findAll(): Promise<EntityWithId<T>[]> {
    const snapshot = await getDocs(this.collectionRef);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async create(data: T): Promise<string> {
    const snapshot = await addDoc(this.collectionRef, data);
    return snapshot.id;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await updateDoc(doc(this.collectionRef, id), data as UpdateData<T>);
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id));
  }
}
