import { deleteObject, getDownloadURL, ref } from 'firebase/storage';

import { getFirebaseStorage } from '@/services/firebase';

export interface StorageService {
  getDownloadUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

export class FirebaseStorageService implements StorageService {
  async getDownloadUrl(path: string): Promise<string> {
    return getDownloadURL(ref(getFirebaseStorage(), path));
  }

  async remove(path: string): Promise<void> {
    await deleteObject(ref(getFirebaseStorage(), path));
  }
}

export const storageService = new FirebaseStorageService();
