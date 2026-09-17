import type { NativeRetailProductCostItemOption } from '../NativeRetailProductCostSheet/NativeRetailProductCostSheet.types';
import type { RetailProductCostMode } from '@/types/data';

export type NativeRetailProductCategoryOption = {
  categoryId: string;
  label: string;
};

export type NativeRetailProductFormValues = {
  categoryId: string;
  productName: string;
  variant: string;
  flavor: string;
  packageSize: string;
  standardSalePrice: string;
  skuCode: string;
  costMode: RetailProductCostMode | '';
  directCostItemId: string;
};

export type NativeRetailProductFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailProductFormValues) => Promise<void>;
  categories: readonly NativeRetailProductCategoryOption[];
  costItems?: readonly NativeRetailProductCostItemOption[];
  initialValues?: Partial<NativeRetailProductFormValues>;
  mode?: 'create' | 'edit';
  onOpenComposition?: () => void;
  title?: string;
};
