import type { FirestoreTimestamp } from './retailClient';

export type RetailCostItem = {
  costItemId: string;
  name: string;
  normalizedName: string;
  unit: string;
  supplier?: string;
  active: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RetailCostItemDraft = {
  name: string;
  unit: string;
  supplier?: string;
  active?: boolean;
};

export type RetailCostItemPatch = {
  name?: string;
  unit?: string;
  supplier?: string | null;
  active?: boolean;
};

export type RetailCostEntry = {
  entryId: string;
  effectiveDate: string;
  purchasedQuantity: number;
  purchaseTotalCost: number;
  normalizedUnitCost: number;
  unit: string;
  supplier?: string;
  createdAt: FirestoreTimestamp;
};

export type RetailCostEntryDraft = {
  effectiveDate: string;
  purchasedQuantity: number;
  purchaseTotalCost: number;
  supplier?: string;
  unit?: string;
};

export type RetailCompositionComponent = {
  costItemId: string;
  quantity: number;
  unit: string;
  costItemNameSnapshot: string;
};

export type RetailCompositionVersion = {
  compositionVersionId: string;
  productId: string;
  effectiveFrom: string;
  active: boolean;
  components: readonly RetailCompositionComponent[];
  createdAt: FirestoreTimestamp;
};

export type RetailCompositionVersionDraft = {
  effectiveFrom: string;
  components: readonly RetailCompositionComponent[];
  active?: boolean;
};

export type RetailCostResolutionReason =
  | 'invalid_reference_date'
  | 'missing_cost_mode'
  | 'missing_direct_cost_item'
  | 'direct_cost_item_not_found'
  | 'no_cost_before_date'
  | 'missing_composition'
  | 'no_composition_before_date';

export type RetailIncompleteCostReason =
  'invalid_composition' | 'missing_component_cost' | 'component_unit_mismatch';

export type RetailProductCostBreakdown = {
  costItemId: string;
  costItemName: string;
  quantity: number;
  unit: string;
  effectiveDate: string;
  unitCost: number;
  totalCost: number;
};

export type RetailProductCostResolution =
  | {
      status: 'available';
      productId: string;
      referenceDate: string;
      cost: number;
      breakdown: readonly RetailProductCostBreakdown[];
      compositionVersionId?: string;
    }
  | {
      status: 'unavailable';
      productId: string;
      referenceDate: string;
      reason: RetailCostResolutionReason;
      message: string;
    }
  | {
      status: 'incomplete';
      productId: string;
      referenceDate: string;
      reason: RetailIncompleteCostReason;
      message: string;
      missingCostItemIds?: readonly string[];
      breakdown: readonly RetailProductCostBreakdown[];
      compositionVersionId?: string;
    };
