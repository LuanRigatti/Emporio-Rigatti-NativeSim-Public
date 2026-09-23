export type NativeRetailCostEntryFormValues = {
  effectiveDate: string;
  purchasedQuantity: string;
  purchaseTotalCost: string;
  supplier: string;
};

export type NativeRetailCostEntryFormSheetProps = {
  visible: boolean;
  itemUnit: string;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailCostEntryFormValues) => Promise<void>;
  initialValues?: Partial<NativeRetailCostEntryFormValues>;
  mode?: 'create' | 'edit';
  title?: string;
};
