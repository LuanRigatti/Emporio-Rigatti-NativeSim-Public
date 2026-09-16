export type NativeRetailCostItemFormValues = {
  name: string;
  unit: string;
  supplier: string;
};

export type NativeRetailCostItemFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailCostItemFormValues) => Promise<void>;
  initialValues?: Partial<NativeRetailCostItemFormValues>;
  mode?: 'create' | 'edit';
  title?: string;
};
