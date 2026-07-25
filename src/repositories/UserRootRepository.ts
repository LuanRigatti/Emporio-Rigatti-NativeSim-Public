import { get, ref } from 'firebase/database';

import { DataError, toDataError } from '@/services/data/DataError';
import { userRootPath } from '@/services/data/paths';
import { getFirebaseDatabase } from '@/services/firebase';

export class UserRootRepository {
  public constructor(private readonly uid: string) {}

  public async exists(): Promise<boolean> {
    try {
      const snapshot = await get(ref(getFirebaseDatabase(), userRootPath(this.uid)));
      return snapshot.exists();
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw toDataError(error, 'NÃ£o foi possÃ­vel verificar os dados da conta.');
    }
  }

  public async assertExists(): Promise<void> {
    if (await this.exists()) return;

    throw new DataError(
      'user-data-not-found',
      'A conta autenticada nÃ£o possui o nÃ³ usuarios/{uid}. A sincronizaÃ§Ã£o foi interrompida.',
    );
  }
}
