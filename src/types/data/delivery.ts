import type { UnknownRecord } from './common';

export type PaymentMethod = 'Dinheiro' | 'Pix';

export type DeliveryStatus = 'Pago' | 'Não Pago' | (string & {});

export type InvoiceStatus = 'emitido' | 'a_emitir';

export interface Delivery {
  id: string;
  cliente: string;
  quantidade: number;
  valor: number;
  status: DeliveryStatus;
  entregue: boolean;
  data: string;
  invoiceStatus?: InvoiceStatus;
  endereco?: string;
  metodoPagamento?: PaymentMethod;
  observacao?: string;
  legacyFields?: UnknownRecord;
}

export interface DeliveryDraft {
  id?: string;
  clientName: string;
  address: string;
  addressConfirmed: boolean;
  quantity: number;
  value: number;
  valueWasManuallyChanged: boolean;
  date: string;
  status: 'Pago' | 'Não Pago';
  delivered: boolean;
  invoiceStatus: InvoiceStatus;
  paymentMethod?: PaymentMethod;
}

export interface DeliveryFilters {
  mode: 'today' | 'all';
  date?: string;
  search?: string;
  clientName?: string;
  status?: 'Todos' | 'Pago' | 'Não Pago';
}

export interface DeliveryBulkPatch {
  status?: 'Pago' | 'Não Pago';
  entregue?: boolean;
  invoiceStatus?: InvoiceStatus;
}
