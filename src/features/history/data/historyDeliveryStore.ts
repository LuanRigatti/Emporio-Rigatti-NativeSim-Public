import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NativeBottomSheetConfirmation } from '@/components/native';
import { formatCurrency, normalizeClientKey, normalizeMoney } from '@/utils/data';

import type { HistoryDelivery } from './historyMocks';

let addedDeliveries: readonly HistoryDelivery[] = [];
const listeners = new Set<() => void>();
const STORAGE_KEY = '@pareact/history-added-deliveries';
let hasLocalMutation = false;
let storageWriteQueue = Promise.resolve();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function persistDeliveries() {
  const serialized = JSON.stringify(addedDeliveries);
  storageWriteQueue = storageWriteQueue
    .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized))
    .catch(() => undefined);
}

async function restoreAddedDeliveries() {
  try {
    const serialized = await AsyncStorage.getItem(STORAGE_KEY);
    if (serialized && !hasLocalMutation) {
      const restored = JSON.parse(serialized) as unknown;
      if (Array.isArray(restored)) {
        addedDeliveries = restored as HistoryDelivery[];
      }
    }
  } catch {
    // In-memory state remains the safe fallback when persistence is unavailable.
  } finally {
    notifyListeners();
  }
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addHistoryDelivery(confirmation: NativeBottomSheetConfirmation): HistoryDelivery {
  const delivery: HistoryDelivery = {
    id: `history-local-${Date.now()}`,
    cliente: confirmation.client.title,
    data: localDate(confirmation.date),
    status: 'pendente',
    quantidadeBaldes: confirmation.quantity,
    valor: formatCurrency(confirmation.bucketPrice * confirmation.quantity),
    formaPagamento: '',
    bairro: '',
    observacoes: '',
  };

  const clientKey = normalizeClientKey(delivery.cliente);
  const matchingDeliveries = addedDeliveries.filter(
    (item) => normalizeClientKey(item.cliente) === clientKey,
  );

  if (matchingDeliveries.length > 0) {
    const firstMatch = matchingDeliveries[0];
    const mergedDelivery: HistoryDelivery = {
      ...firstMatch,
      quantidadeBaldes:
        matchingDeliveries.reduce((total, item) => total + item.quantidadeBaldes, 0) +
        delivery.quantidadeBaldes,
      valor: formatCurrency(
        matchingDeliveries.reduce((total, item) => total + (normalizeMoney(item.valor) ?? 0), 0) +
          confirmation.bucketPrice * confirmation.quantity,
      ),
    };

    addedDeliveries = addedDeliveries.reduce<HistoryDelivery[]>((result, item) => {
      if (normalizeClientKey(item.cliente) !== clientKey) {
        result.push(item);
      } else if (item.id === firstMatch.id) {
        result.push(mergedDelivery);
      }
      return result;
    }, []);
  } else {
    addedDeliveries = [delivery, ...addedDeliveries];
  }
  hasLocalMutation = true;
  persistDeliveries();
  notifyListeners();
  return delivery;
}

export function removeAddedHistoryDeliveries(ids: ReadonlySet<string>): void {
  if (ids.size === 0) return;

  addedDeliveries = addedDeliveries.filter((delivery) => !ids.has(delivery.id));
  hasLocalMutation = true;
  persistDeliveries();
  notifyListeners();
}

export function updateAddedHistoryDeliveryQuantity(
  deliveryId: string,
  quantity: number,
  bucketPrice: number,
): void {
  const nextQuantity = Math.max(1, Math.round(quantity));
  const current = addedDeliveries.find((delivery) => delivery.id === deliveryId);
  if (!current) return;

  addedDeliveries = addedDeliveries.map((delivery) =>
    delivery.id === deliveryId
      ? {
          ...delivery,
          quantidadeBaldes: nextQuantity,
          valor: formatCurrency(bucketPrice * nextQuantity),
        }
      : delivery,
  );
  hasLocalMutation = true;
  persistDeliveries();
  notifyListeners();
}

export function subscribeToAddedHistoryDeliveries(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAddedHistoryDeliveries(): readonly HistoryDelivery[] {
  return addedDeliveries;
}

void restoreAddedDeliveries();
