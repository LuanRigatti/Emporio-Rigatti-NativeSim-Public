import type { RetailProductCostMode } from '@/types/data';

export type NativeRetailProductCostItemOption = {
  costItemId: string;
  label: string;
  unit: string;
};

export type NativeRetailProductCostFormValues = {
  costMode: RetailProductCostMode | '';
  directCostItemId: string;
};

export type NativeRetailProductCostSheetProps = {
  visible: boolean;
  costItems: readonly NativeRetailProductCostItemOption[];
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailProductCostFormValues) => Promise<void>;
  onOpenComposition?: () => void;
  initialValues?: Partial<NativeRetailProductCostFormValues>;
};
