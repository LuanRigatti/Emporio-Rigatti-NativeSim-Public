import { get, ref, set } from 'firebase/database';

import { getFirebaseDatabase } from '@/services/firebase';
import { DataError, toDataError } from '@/services/data/DataError';
import { DataValidationError } from '@/utils/data';

import { UserRootRepository } from './UserRootRepository';

export interface NodeCodec<T> {
  emptyValue: T;
  validate(value: unknown): void;
  fromFirebase(value: unknown): T;
  toFirebase(value: T): unknown;
}

export class RealtimeNodeRepository<T> {
  public constructor(
    private readonly uid: string,
    private readonly node: string,
    private readonly codec: NodeCodec<T>,
  ) {}

  public async read(): Promise<T> {
    try {
      const snapshot = await get(ref(getFirebaseDatabase(), `usuarios/${this.uid}/${this.node}`));
      if (!snapshot.exists()) return this.codec.emptyValue;

      const rawValue: unknown = snapshot.val();
      this.codec.validate(rawValue);
      return this.codec.fromFirebase(rawValue);
    } catch (error) {
      if (error instanceof DataError) throw error;
      if (error instanceof DataValidationError) {
        throw new DataError('validation', error.message, error);
      }
      throw toDataError(error, `Não foi possível ler ${this.node}.`);
    }
  }

  public async replace(value: T): Promise<void> {
    try {
      await new UserRootRepository(this.uid).assertExists();
      const rawValue = this.codec.toFirebase(value);
      this.codec.validate(rawValue);
      await set(ref(getFirebaseDatabase(), `usuarios/${this.uid}/${this.node}`), rawValue);
    } catch (error) {
      if (error instanceof DataError) throw error;
      if (error instanceof DataValidationError) {
        throw new DataError('validation', error.message, error);
      }
      throw toDataError(error, `Não foi possível gravar ${this.node}.`);
    }
  }
}
