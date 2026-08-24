import {
  CustomClientRepository,
  DailyExpenseRepository,
  DeliveryRepository,
  FactoryReceiptRepository,
  MonthlyExpenseRepository,
  PushTokenRepository,
  UserRootRepository,
} from '@/repositories';
import { asyncStorageCacheService } from '@/services/cache';
import { DataError, toDataError } from './DataError';

import type { CachedUserDataSnapshot, UserDataSnapshot } from './UserDataSnapshot';

export interface DataLoadResult {
  snapshot: UserDataSnapshot;
  source: 'cache' | 'network';
  isStale: boolean;
}

export interface StaleWhileRevalidateResult {
  cached: CachedUserDataSnapshot | null;
  revalidate: Promise<DataLoadResult>;
}

export class UserDataService {
  public async readFromFirebase(uid: string): Promise<UserDataSnapshot> {
    try {
      const userNodeExists = await new UserRootRepository(uid).exists();
      if (!userNodeExists) {
        throw new DataError(
          'user-data-not-found',
          'A conta autenticada não possui dados em usuarios/{uid}. A sincronização foi interrompida.',
        );
      }

      const [entregas, gastosDiarios, gastosMensais, recebimentoBaldes, clientesCustom, pushToken] =
        await Promise.all([
          new DeliveryRepository(uid).read(),
          new DailyExpenseRepository(uid).read(),
          new MonthlyExpenseRepository(uid).read(),
          new FactoryReceiptRepository(uid).read(),
          new CustomClientRepository(uid).read(),
          new PushTokenRepository(uid).read(),
        ]);

      return {
        entregas,
        gastosDiarios,
        gastosMensais,
        recebimentoBaldes,
        clientesCustom,
        pushToken,
      };
    } catch (error) {
      if (error instanceof DataError && error.code === 'user-data-not-found') throw error;
      throw toDataError(error, 'Não foi possível carregar os dados do usuário.');
    }
  }

  public async revalidate(uid: string): Promise<DataLoadResult> {
    const snapshot = await this.readFromFirebase(uid);
    await asyncStorageCacheService.write(uid, snapshot);
    return { snapshot, source: 'network', isStale: false };
  }

  public async loadStaleWhileRevalidate(uid: string): Promise<StaleWhileRevalidateResult> {
    let cached: CachedUserDataSnapshot | null = null;
    try {
      cached = await asyncStorageCacheService.read(uid);
    } catch (error) {
      if (!(error instanceof DataError)) throw error;
    }

    return {
      cached,
      revalidate: this.revalidate(uid),
    };
  }

  public async loadWithCacheFallback(uid: string): Promise<DataLoadResult> {
    let cached: CachedUserDataSnapshot | null = null;
    try {
      cached = await asyncStorageCacheService.read(uid);
    } catch (error) {
      if (!(error instanceof DataError)) throw error;
    }

    try {
      return await this.revalidate(uid);
    } catch (error) {
      if (error instanceof DataError && error.code === 'user-data-not-found') throw error;
      if (!cached) throw error;
      return {
        snapshot: cached,
        source: 'cache',
        isStale: true,
      };
    }
  }
}

export const userDataService = new UserDataService();
