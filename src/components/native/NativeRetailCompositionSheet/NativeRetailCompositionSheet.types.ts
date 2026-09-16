export type NativeRetailCompositionCostItemOption = {
  costItemId: string;
  label: string;
  unit: string;
};

export type NativeRetailCompositionComponentValues = {
  key: string;
  costItemId: string;
  quantity: string;
};

export type NativeRetailCompositionFormValues = {
  effectiveFrom: string;
  components: readonly NativeRetailCompositionComponentValues[];
};

export type NativeRetailCompositionSheetProps = {
  visible: boolean;
  costItems: readonly NativeRetailCompositionCostItemOption[];
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailCompositionFormValues) => Promise<void>;
  initialValues?: Partial<NativeRetailCompositionFormValues>;
};
