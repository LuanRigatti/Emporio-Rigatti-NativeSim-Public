import type { FirestoreTimestamp } from './retailClient';

export type RetailCategory = {
  categoryId: string;
  label: string;
  normalizedLabel: string;
  active: boolean;
  sortOrder?: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RetailCategoryDraft = {
  label: string;
  active?: boolean;
  sortOrder?: number;
};

export type RetailCategoryPatch = {
  label?: string;
  active?: boolean;
  sortOrder?: number | null;
};
