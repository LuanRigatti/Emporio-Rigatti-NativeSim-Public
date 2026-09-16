import type { FirestoreTimestamp } from './retailClient';

export type RetailProductCostMode = 'direct' | 'composition';

export type RetailProduct = {
  productId: string;
  skuCode?: string;
  categoryId: string;
  categoryName?: string;
  productName: string;
  variant?: string;
  flavor?: string;
  packageSize?: string;
  standardSalePrice: number;
  active: boolean;
  productFamilyId?: string;
  costMode?: RetailProductCostMode;
  directCostItemId?: string;
  compositionVersionId?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RetailProductDraft = {
  skuCode?: string;
  categoryId: string;
  categoryName?: string;
  productName: string;
  variant?: string;
  flavor?: string;
  packageSize?: string;
  standardSalePrice: number;
  active?: boolean;
  productFamilyId?: string;
  costMode?: RetailProductCostMode;
  directCostItemId?: string;
  compositionVersionId?: string;
};

export type RetailProductPatch = {
  categoryId?: string;
  productName?: string;
  standardSalePrice?: number;
  active?: boolean;
  skuCode?: string | null;
  categoryName?: string | null;
  variant?: string | null;
  flavor?: string | null;
  packageSize?: string | null;
  productFamilyId?: string | null;
  costMode?: RetailProductCostMode | null;
  directCostItemId?: string | null;
  compositionVersionId?: string | null;
};
