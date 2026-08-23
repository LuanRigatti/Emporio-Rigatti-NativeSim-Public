import type { UnknownRecord } from './common';
import type { ClientId } from './client';

export type PaymentMethod = 'Dinheiro' | 'Pix';

export type DeliveryStatus = 'Pago' | 'Não Pago' | (string & {});

export type InvoiceStatus = 'emitido' | 'a_emitir';
export type BoletoStatus = 'emitido' | 'a_emitir';

export interface Delivery {
  id: string;
  createdAt?: number;
  clientId?: ClientId;
  cliente: string;
  quantidade: number;
  valor: number;
  precoUnitarioHistorico?: number;
  status: DeliveryStatus;
  entregue: boolean;
  data: string;
  invoiceStatus?: InvoiceStatus;
  boletoStatus?: BoletoStatus;
  endereco?: string;
  metodoPagamento?: PaymentMethod;
  observacao?: string;
  legacyFields?: UnknownRecord;
}

export interface DeliveryDraft {
  id?: string;
  clientId?: ClientId;
  clientName: string;
  address: string;
  addressConfirmed: boolean;
  quantity: number;
  value: number;
  valueWasManuallyChanged: boolean;
  historicalUnitPrice?: number;
  date: string;
  status: 'Pago' | 'Não Pago';
  delivered: boolean;
  invoiceStatus: InvoiceStatus;
  boletoStatus?: BoletoStatus;
  paymentMethod?: PaymentMethod;
}

export interface DeliveryFilters {
  mode: 'today' | 'all';
  date?: string;
  startDate?: string;
  endDate?: string;
  deliveryId?: string;
  deliveryIds?: readonly string[];
  clientId?: ClientId;
  clientIds?: readonly ClientId[];
  search?: string;
  clientName?: string;
  status?: 'Todos' | 'Pago' | 'Não Pago';
  deliveryStatus?: 'Todos' | 'Entregue' | 'Não entregue';
  invoiceStatus?: 'Todos' | InvoiceStatus;
  boletoStatus?: 'Todos' | BoletoStatus;
}

export interface DeliveryBulkPatch {
  status?: 'Pago' | 'Não Pago';
  entregue?: boolean;
  invoiceStatus?: InvoiceStatus;
  boletoStatus?: BoletoStatus;
}
