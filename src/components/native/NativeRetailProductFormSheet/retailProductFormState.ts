import type {
  NativeRetailProductCategoryOption,
  NativeRetailProductFormValues,
} from './NativeRetailProductFormSheet.types';
import type { NativeRetailProductCostItemOption } from '../NativeRetailProductCostSheet/NativeRetailProductCostSheet.types';

type RetailProductCostConfiguration = Pick<
  Partial<NativeRetailProductFormValues>,
  'costMode' | 'directCostItemId'
>;

export function retailProductCostConfigurationKey(
  values: RetailProductCostConfiguration | null | undefined,
): string {
  const costMode = values?.costMode ?? '';
  const directCostItemId = costMode === 'direct' ? (values?.directCostItemId?.trim() ?? '') : '';
  return `${costMode}|${directCostItemId}`;
}

export function retailProductFormInitializationKey(
  initialValues: Partial<NativeRetailProductFormValues> | undefined,
  categories: readonly NativeRetailProductCategoryOption[],
  costItems: readonly NativeRetailProductCostItemOption[],
): string {
  return JSON.stringify({
    categories: categories.map(({ categoryId, label }) => [categoryId, label]),
    costItems: costItems.map(({ costItemId, label, unit }) => [costItemId, label, unit]),
    initialValues: {
      categoryId: initialValues?.categoryId ?? '',
      costMode: initialValues?.costMode ?? '',
      directCostItemId: initialValues?.directCostItemId ?? '',
      flavor: initialValues?.flavor ?? '',
      packageSize: initialValues?.packageSize ?? '',
      productName: initialValues?.productName ?? '',
      skuCode: initialValues?.skuCode ?? '',
      standardSalePrice: initialValues?.standardSalePrice ?? '',
      variant: initialValues?.variant ?? '',
    },
  });
}
