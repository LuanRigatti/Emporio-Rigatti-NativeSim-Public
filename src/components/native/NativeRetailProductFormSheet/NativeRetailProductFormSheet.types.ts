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
};

export type NativeRetailProductFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailProductFormValues) => Promise<void>;
  categories: readonly NativeRetailProductCategoryOption[];
  initialValues?: Partial<NativeRetailProductFormValues>;
  mode?: 'create' | 'edit';
  title?: string;
};
