import type { UnknownRecord } from './common';

export type ClientId = `legacy:${string}` | `client:${string}`;

export type ClientSource = 'historical' | 'custom' | 'delivery';

export interface CustomClient {
  nome: string;
  preco: number;
  endereco?: string;
  usesInvoice?: boolean;
  legacyFields?: UnknownRecord;
}

export interface ClientModel {
  clientId: ClientId;
  canonicalName: string;
  normalizedName: string;
  sources: ClientSource[];
  customConfig?: CustomClient;
  address?: string;
  hasIncompleteAddress: boolean;
  currentPrice?: number;
  usesInvoice: boolean;
}

export interface ClientFinancialSummary {
  deliveryCount: number;
  quantity: number;
  revenue: number;
  paid: number;
  pending: number;
  balance: number;
}
