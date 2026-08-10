import type { UnknownRecord } from './common';

export interface FactoryPayment {
  id: string;
  data: string;
  valor: number;
  legacyFields?: UnknownRecord;
}

export interface FactoryReceipt {
  id: string;
  quantidade: number;
  data: string;
  precoUnitarioHistorico?: number;
  valorTotal: number;
  concluido: boolean;
  pagamentos: FactoryPayment[];
  legacyFields?: UnknownRecord;
}

export type FactoryPeriod = 'month' | 'all';

export interface FactoryFilters {
  endDate?: string;
  period: FactoryPeriod;
  month?: string;
  startDate?: string;
}

export interface FactoryReceiptDraft {
  quantity: number;
  date: string;
}

export interface FactoryPaymentDraft {
  date: string;
  amount: number;
}
