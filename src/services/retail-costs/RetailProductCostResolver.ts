import type {
  RetailCompositionVersion,
  RetailCostEntry,
  RetailCostItem,
  RetailProduct,
  RetailProductCostBreakdown,
  RetailProductCostResolution,
} from '@/types/data';

import { isStrictRetailIsoDate, retailUnitsMatch } from './retailCostUtils';

export type RetailProductCostResolverInput = {
  product: Pick<
    RetailProduct,
    'productId' | 'costMode' | 'directCostItemId' | 'compositionVersionId'
  >;
  referenceDate: string;
  costItems: readonly RetailCostItem[];
  costEntriesByItemId: ReadonlyMap<string, readonly RetailCostEntry[]>;
  compositionVersions: readonly RetailCompositionVersion[];
};

type HistoricalCost = {
  entry: RetailCostEntry;
  item: RetailCostItem;
};

function unavailable(
  productId: string,
  referenceDate: string,
  reason: Extract<RetailProductCostResolution, { status: 'unavailable' }>['reason'],
  message: string,
): RetailProductCostResolution {
  return { message, productId, reason, referenceDate, status: 'unavailable' };
}

function findHistoricalCost(
  item: RetailCostItem,
  entries: readonly RetailCostEntry[] | undefined,
  referenceDate: string,
): HistoricalCost | undefined {
  if (!entries) return undefined;
  const eligible = entries
    .filter(
      (entry) =>
        isStrictRetailIsoDate(entry.effectiveDate) &&
        entry.effectiveDate <= referenceDate &&
        retailUnitsMatch(entry.unit, item.unit) &&
        Number.isFinite(entry.normalizedUnitCost) &&
        entry.normalizedUnitCost >= 0,
    )
    .slice()
    .sort(
      (left, right) =>
        right.effectiveDate.localeCompare(left.effectiveDate) ||
        right.entryId.localeCompare(left.entryId),
    );
  const entry = eligible[0];
  return entry ? { entry, item } : undefined;
}

function breakdownFor(resolved: HistoricalCost, quantity: number): RetailProductCostBreakdown {
  return {
    costItemId: resolved.item.costItemId,
    costItemName: resolved.item.name,
    effectiveDate: resolved.entry.effectiveDate,
    quantity,
    totalCost: quantity * resolved.entry.normalizedUnitCost,
    unit: resolved.item.unit,
    unitCost: resolved.entry.normalizedUnitCost,
  };
}

export function resolveRetailProductCost(
  input: RetailProductCostResolverInput,
): RetailProductCostResolution {
  const { product, referenceDate } = input;
  if (!isStrictRetailIsoDate(referenceDate)) {
    return unavailable(
      product.productId,
      referenceDate,
      'invalid_reference_date',
      'A data de referência do custo é inválida.',
    );
  }
  if (!product.costMode) {
    return unavailable(
      product.productId,
      referenceDate,
      'missing_cost_mode',
      'O produto ainda não possui um modo de custo configurado.',
    );
  }

  if (product.costMode === 'direct') {
    if (!product.directCostItemId) {
      return unavailable(
        product.productId,
        referenceDate,
        'missing_direct_cost_item',
        'O produto direto não possui item de custo vinculado.',
      );
    }
    const item = input.costItems.find(
      (candidate) => candidate.costItemId === product.directCostItemId,
    );
    if (!item) {
      return unavailable(
        product.productId,
        referenceDate,
        'direct_cost_item_not_found',
        'O item de custo direto não foi encontrado.',
      );
    }
    const resolved = findHistoricalCost(
      item,
      input.costEntriesByItemId.get(item.costItemId),
      referenceDate,
    );
    if (!resolved) {
      return unavailable(
        product.productId,
        referenceDate,
        'no_cost_before_date',
        'Não existe custo histórico válido para essa data.',
      );
    }
    return {
      breakdown: [breakdownFor(resolved, 1)],
      cost: resolved.entry.normalizedUnitCost,
      productId: product.productId,
      referenceDate,
      status: 'available',
    };
  }

  const validVersion = input.compositionVersions
    .filter(
      (version) =>
        version.productId === product.productId &&
        version.active &&
        isStrictRetailIsoDate(version.effectiveFrom) &&
        version.effectiveFrom <= referenceDate,
    )
    .slice()
    .sort(
      (left, right) =>
        right.effectiveFrom.localeCompare(left.effectiveFrom) ||
        right.compositionVersionId.localeCompare(left.compositionVersionId),
    )[0];

  if (!validVersion) {
    return unavailable(
      product.productId,
      referenceDate,
      input.compositionVersions.some((version) => version.productId === product.productId)
        ? 'no_composition_before_date'
        : 'missing_composition',
      input.compositionVersions.some((version) => version.productId === product.productId)
        ? 'Não existe composição válida para essa data.'
        : 'O produto ainda não possui uma composição configurada.',
    );
  }
  if (!validVersion.components.length) {
    return {
      breakdown: [],
      compositionVersionId: validVersion.compositionVersionId,
      message: 'A composição não possui componentes válidos.',
      productId: product.productId,
      reason: 'invalid_composition',
      referenceDate,
      status: 'incomplete',
    };
  }

  const breakdown: RetailProductCostBreakdown[] = [];
  const missingCostItemIds: string[] = [];
  let componentUnitMismatch = false;
  let invalidComponent = false;
  for (const component of validVersion.components) {
    if (!Number.isFinite(component.quantity) || component.quantity <= 0) {
      invalidComponent = true;
      continue;
    }
    const item = input.costItems.find((candidate) => candidate.costItemId === component.costItemId);
    if (!item) {
      missingCostItemIds.push(component.costItemId);
      continue;
    }
    if (!retailUnitsMatch(component.unit, item.unit)) {
      componentUnitMismatch = true;
      continue;
    }
    const resolved = findHistoricalCost(
      item,
      input.costEntriesByItemId.get(item.costItemId),
      referenceDate,
    );
    if (!resolved) {
      missingCostItemIds.push(component.costItemId);
      continue;
    }
    breakdown.push(breakdownFor(resolved, component.quantity));
  }

  if (invalidComponent || componentUnitMismatch || missingCostItemIds.length) {
    return {
      breakdown,
      compositionVersionId: validVersion.compositionVersionId,
      ...(missingCostItemIds.length ? { missingCostItemIds } : {}),
      message: invalidComponent
        ? 'A composição contém uma quantidade inválida.'
        : componentUnitMismatch
          ? 'A composição contém uma unidade diferente da unidade-base do item.'
          : 'Um ou mais componentes não possuem custo histórico válido para essa data.',
      productId: product.productId,
      reason: invalidComponent
        ? 'invalid_composition'
        : componentUnitMismatch
          ? 'component_unit_mismatch'
          : 'missing_component_cost',
      referenceDate,
      status: 'incomplete',
    };
  }

  return {
    breakdown,
    compositionVersionId: validVersion.compositionVersionId,
    cost: breakdown.reduce((total, component) => total + component.totalCost, 0),
    productId: product.productId,
    referenceDate,
    status: 'available',
  };
}
