export type NativeRetailCategoryFormValues = {
  label: string;
};

export type NativeRetailCategoryFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailCategoryFormValues) => Promise<void>;
  initialValues?: Partial<NativeRetailCategoryFormValues>;
  mode?: 'create' | 'edit';
  title?: string;
};
