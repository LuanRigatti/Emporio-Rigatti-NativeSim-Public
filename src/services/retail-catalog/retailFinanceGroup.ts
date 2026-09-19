import type { RetailFinanceGroup } from '@/types/data';
import { normalizeClientKey } from '@/utils/data';

export function isRetailFinanceGroup(value: unknown): value is RetailFinanceGroup {
  return value === 'baskets' || value === 'buckets' || value === 'savories' || value === 'other';
}

export function legacyRetailFinanceGroupForLabel(value: string): RetailFinanceGroup {
  switch (normalizeClientKey(value)) {
    case 'cestas':
      return 'baskets';
    case 'baldes':
      return 'buckets';
    case 'salgados':
      return 'savories';
    default:
      return 'other';
  }
}

export function retailFinanceGroupForCategory(category: {
  financeGroup?: RetailFinanceGroup;
  label: string;
}): RetailFinanceGroup {
  return category.financeGroup ?? legacyRetailFinanceGroupForLabel(category.label);
}
