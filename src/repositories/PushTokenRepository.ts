import { get, ref, set } from 'firebase/database';

import { ENABLE_FIREBASE_WRITES } from '@/config/featureFlags';
import { DataError, toDataError } from '@/services/data/DataError';
import { userNodePath } from '@/services/data/paths';
import { getFirebaseDatabase } from '@/services/firebase';
import { DataValidationError, validatePushToken } from '@/utils/data';

import { UserRootRepository } from './UserRootRepository';

export class PushTokenRepository {
  public constructor(private readonly uid: string) {}

  public async read(): Promise<string | undefined> {
    try {
      const snapshot = await get(ref(getFirebaseDatabase(), userNodePath(this.uid, 'pushToken')));
      if (!snapshot.exists()) return undefined;
      const value: unknown = snapshot.val();
      validatePushToken(value);
      return typeof value === 'string' ? value : undefined;
    } catch (error) {
      if (error instanceof DataError) throw error;
      if (error instanceof DataValidationError) {
        throw new DataError('validation', error.message, error);
      }
      throw toDataError(error, 'Não foi possível ler o token de push.');
    }
  }

  public async replace(token: string): Promise<void> {
    if (!ENABLE_FIREBASE_WRITES) {
      throw new DataError(
        'permission',
        'As escritas Firebase estao desativadas durante a primeira ativacao somente leitura.',
      );
    }
    if (token.trim() === '') throw new DataError('validation', 'Token de push vazio.');
    try {
      await new UserRootRepository(this.uid).assertExists();
      await set(ref(getFirebaseDatabase(), userNodePath(this.uid, 'pushToken')), token);
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw toDataError(error, 'Não foi possível gravar o token de push.');
    }
  }
}
