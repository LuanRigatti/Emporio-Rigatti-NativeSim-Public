import {
  addHistoryDeliveryRecord,
  getHistoryDeliveries,
  removeAddedHistoryDeliveries,
  renameAddedHistoryDeliveries,
  subscribeToHistoryDeliveries,
  toggleHistoryDeliveryStatus,
} from '@/features/history/data/historyDeliveryStore';
import type { Delivery } from '@/types/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

export type DeliveryRegistrationInput = {
  clientName: string;
  date: Date;
  quantity: number;
  bucketPrice: number;
};

export interface DeliveryDataSource {
  getAll(): readonly Delivery[];
  subscribe(listener: () => void): () => void;
  createFromRegistration(input: DeliveryRegistrationInput): Delivery;
  remove(deliveryId: string): void;
  renameClientReferences(oldName: string, newName: string): void;
  toggleStatus(deliveryId: string): void;
}

function mapHistoryDelivery(delivery: ReturnType<typeof getHistoryDeliveries>[number]): Delivery {
  return {
    id: delivery.id,
    cliente: delivery.cliente,
    quantidade: delivery.quantidadeBaldes,
    valor: normalizeMoney(delivery.valor) ?? 0,
    precoUnitarioHistorico: delivery.precoUnitarioHistorico,
    status: delivery.status === 'pendente' ? 'NÃ£o Pago' : 'Pago',
    entregue: delivery.status !== 'pendente',
    data: normalizeLegacyDate(delivery.data) ?? delivery.data,
    metodoPagamento:
      delivery.formaPagamento === 'Dinheiro' || delivery.formaPagamento === 'Pix'
        ? delivery.formaPagamento
        : undefined,
  };
}

class MockDeliveryDataSource implements DeliveryDataSource {
  public getAll(): readonly Delivery[] {
    return getHistoryDeliveries().map(mapHistoryDelivery);
  }

  public subscribe(listener: () => void): () => void {
    return subscribeToHistoryDeliveries(listener);
  }

  public createFromRegistration(input: DeliveryRegistrationInput): Delivery {
    return mapHistoryDelivery(addHistoryDeliveryRecord(input));
  }

  public remove(deliveryId: string): void {
    removeAddedHistoryDeliveries(new Set([deliveryId]));
  }

  public renameClientReferences(oldName: string, newName: string): void {
    renameAddedHistoryDeliveries(oldName, newName);
  }

  public toggleStatus(deliveryId: string): void {
    toggleHistoryDeliveryStatus(deliveryId);
  }
}

export const mockDeliveryDataSource: DeliveryDataSource = new MockDeliveryDataSource();
