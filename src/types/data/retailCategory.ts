import type { FirestoreTimestamp } from './retailClient';

export type RetailFinanceGroup = 'baskets' | 'buckets' | 'savories' | 'other';

export const RETAIL_FINANCE_GROUP_OPTIONS = [
  { label: 'Cestas', value: 'baskets' },
  { label: 'Baldes', value: 'buckets' },
  { label: 'Salgados', value: 'savories' },
  { label: 'Outros', value: 'other' },
] as const satisfies readonly { label: string; value: RetailFinanceGroup }[];

export type RetailCategory = {
  categoryId: string;
  label: string;
  normalizedLabel: string;
  financeGroup?: RetailFinanceGroup;
  active: boolean;
  sortOrder?: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RetailCategoryDraft = {
  label: string;
  financeGroup?: RetailFinanceGroup;
  active?: boolean;
  sortOrder?: number;
};

export type RetailCategoryPatch = {
  label?: string;
  financeGroup?: RetailFinanceGroup;
  active?: boolean;
  sortOrder?: number | null;
};
