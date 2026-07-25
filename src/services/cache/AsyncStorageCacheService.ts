import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  mapCustomClients,
  mapDailyExpenses,
  mapDeliveries,
  mapFactoryReceipts,
  mapMonthlyExpenses,
} from '@/mappers/firebase';
import type { UnknownRecord } from '@/types/data';
import { DataError } from '@/services/data/DataError';

import type { CachedUserDataSnapshot, UserDataSnapshot } from '../data';

const CACHE_PREFIX = 'pwa_faturamento_cache_';

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new DataError('serialization', 'Cache local inválido.', error);
  }
}

export class AsyncStorageCacheService {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}${uid}`;
  }

  public async read(uid: string): Promise<CachedUserDataSnapshot | null> {
    const serialized = await AsyncStorage.getItem(this.getKey(uid));
    if (!serialized) return null;

    const raw: unknown = parseJson(serialized);
    if (!isRecord(raw)) throw new DataError('serialization', 'Cache local não é um objeto.');

    try {
      const deliveries = raw.entregas === undefined ? [] : mapDeliveries(raw.entregas);
      const dailyExpenses =
        raw.gastosDiarios === undefined ? {} : mapDailyExpenses(raw.gastosDiarios);
      const monthlyExpenses =
        raw.gastosMensais === undefined ? {} : mapMonthlyExpenses(raw.gastosMensais);
      const factoryReceipts =
        raw.recebimentosFabrica !== undefined
          ? mapFactoryReceipts(raw.recebimentosFabrica)
          : raw.recebimentoBaldes === undefined
            ? []
            : mapFactoryReceipts(raw.recebimentoBaldes);
      const customClients =
        raw.clientesCustom === undefined ? {} : mapCustomClients(raw.clientesCustom);

      return {
        entregas: deliveries,
        gastosDiarios: dailyExpenses,
        gastosMensais: monthlyExpenses,
        recebimentoBaldes: factoryReceipts,
        clientesCustom: customClients,
        pushToken: typeof raw.pushToken === 'string' ? raw.pushToken : undefined,
        ts: typeof raw.ts === 'number' ? raw.ts : 0,
      };
    } catch (error) {
      throw new DataError('validation', 'Cache local contém dados inválidos.', error);
    }
  }

  public async write(uid: string, snapshot: UserDataSnapshot): Promise<void> {
    const value: UnknownRecord = {
      entregas: snapshot.entregas,
      gastosDiarios: snapshot.gastosDiarios,
      gastosMensais: snapshot.gastosMensais,
      recebimentosFabrica: snapshot.recebimentoBaldes,
      clientesCustom: snapshot.clientesCustom,
      pushToken: snapshot.pushToken,
      ts: Date.now(),
    };

    try {
      await AsyncStorage.setItem(this.getKey(uid), JSON.stringify(value));
    } catch (error) {
      throw new DataError('serialization', 'Não foi possível salvar o cache local.', error);
    }
  }

  public async remove(uid: string): Promise<void> {
    await AsyncStorage.removeItem(this.getKey(uid));
  }
}

export const asyncStorageCacheService = new AsyncStorageCacheService();
