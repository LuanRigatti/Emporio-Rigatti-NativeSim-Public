import type { NativeBottomSheetConfirmation } from '@/components/native';

import type { HistoryDelivery } from './historyMocks';

let addedDeliveries: readonly HistoryDelivery[] = [];
const listeners = new Set<() => void>();

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
    valor: '',
    formaPagamento: '',
    bairro: '',
    observacoes: '',
  };

  addedDeliveries = [delivery, ...addedDeliveries];
  listeners.forEach((listener) => listener());
  return delivery;
}

export function subscribeToAddedHistoryDeliveries(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAddedHistoryDeliveries(): readonly HistoryDelivery[] {
  return addedDeliveries;
}
