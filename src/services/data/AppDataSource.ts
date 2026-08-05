import { ENABLE_FIREBASE_APP_DATA } from '@/config/featureFlags';
import {
  getHistoryDeliveries,
  subscribeToHistoryDeliveries,
  toggleHistoryDeliveryStatus,
} from '@/features/history/data/historyDeliveryStore';
import { costSettingsStorage, type CostSettings } from '@/services/costs';
import { userDataService } from '@/services/data/UserDataService';
import type { DailyExpenses, Delivery } from '@/types/data';
import type { HistoryDelivery } from '@/features/history/data/historyMocks';
import { formatCurrency, normalizeLegacyDate, normalizeMoney } from '@/utils/data';

import type { UserDataSnapshot } from './UserDataSnapshot';

export type AppDataMode = 'firebase' | 'mock';

export const APP_DATA_MODE: AppDataMode = ENABLE_FIREBASE_APP_DATA ? 'firebase' : 'mock';

function parseCost(value: string): number {
  return normalizeMoney(value) ?? 0;
}

function mapHistoryDelivery(delivery: ReturnType<typeof getHistoryDeliveries>[number]): Delivery {
  const paymentMethod =
    delivery.formaPagamento === 'Dinheiro' || delivery.formaPagamento === 'Pix'
      ? delivery.formaPagamento
      : undefined;

  return {
    id: delivery.id,
    cliente: delivery.cliente,
    quantidade: delivery.quantidadeBaldes,
    valor: parseCost(delivery.valor),
    status: delivery.status === 'pendente' ? 'NÃ£o Pago' : 'Pago',
    entregue: delivery.status !== 'pendente',
    data: normalizeLegacyDate(delivery.data) ?? delivery.data,
    metodoPagamento: paymentMethod,
  };
}

export function toHistoryDelivery(delivery: Delivery): HistoryDelivery {
  return {
    bairro: '',
    cliente: delivery.cliente,
    data: normalizeLegacyDate(delivery.data) ?? delivery.data,
    formaPagamento: delivery.metodoPagamento ?? '',
    id: delivery.id,
    observacoes: delivery.observacao ?? '',
    quantidadeBaldes: delivery.quantidade,
    status: delivery.entregue ? ('concluída' as const) : 'pendente',
    valor: formatCurrency(delivery.valor),
  };
}

function mapMockDailyExpenses(settings: CostSettings): DailyExpenses {
  return Object.fromEntries(
    Object.entries(settings.periods.day).map(([date, values]) => [
      date,
      {
        data: date,
        estar: parseCost(values.estar),
        gasolina: parseCost(values.fuel),
        km: parseCost(values.kilometers),
        precoGasolina: parseCost(values.fuelPrice),
        outros: parseCost(values.other),
      },
    ]),
  );
}

function mapMockMonthlyExpenses(settings: CostSettings): UserDataSnapshot['gastosMensais'] {
  return Object.fromEntries(
    Object.entries(settings.periods.month).map(([month, values]) => [
      month,
      { luz: parseCost(values.light) },
    ]),
  );
}

async function loadMockData(): Promise<UserDataSnapshot> {
  const settings = await costSettingsStorage.load();

  return {
    clientesCustom: {},
    entregas: getHistoryDeliveries().map(mapHistoryDelivery),
    gastosDiarios: mapMockDailyExpenses(settings),
    gastosMensais: mapMockMonthlyExpenses(settings),
    recebimentoBaldes: [],
  };
}

function normalizeSnapshot(snapshot: UserDataSnapshot): UserDataSnapshot {
  return {
    ...snapshot,
    entregas: snapshot.entregas.map((delivery) => ({
      ...delivery,
      data: normalizeLegacyDate(delivery.data) ?? delivery.data,
    })),
  };
}

export async function loadAppData(uid?: string): Promise<UserDataSnapshot> {
  if (APP_DATA_MODE === 'firebase') {
    if (!uid) throw new Error('SessÃ£o nÃ£o disponÃ­vel para carregar os dados.');
    return normalizeSnapshot((await userDataService.loadWithCacheFallback(uid)).snapshot);
  }

  return loadMockData();
}

export function subscribeToAppData(listener: () => void): () => void {
  return APP_DATA_MODE === 'mock' ? subscribeToHistoryDeliveries(listener) : () => undefined;
}

export async function toggleAppDelivery(
  uid: string | undefined,
  deliveryId: string,
): Promise<void> {
  if (APP_DATA_MODE === 'mock') {
    toggleHistoryDeliveryStatus(deliveryId);
    return;
  }

  if (!uid) throw new Error('SessÃ£o nÃ£o disponÃ­vel para atualizar a entrega.');
  const { DeliveryMutationService } = await import('@/services/deliveries/DeliveryMutationService');
  await new DeliveryMutationService(uid).toggleDelivered(deliveryId);
}
