export type NativeRetailClientFormValues = {
  name: string;
  phone: string;
  address: string;
  hasReferral: boolean;
  sourceType: string;
  referredByName: string;
  defaultDeliveryFee: string;
};

export type NativeRetailClientFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeRetailClientFormValues) => Promise<void>;
  initialValues?: Partial<NativeRetailClientFormValues>;
  mode?: 'create' | 'edit';
  title?: string;
};

export const EMPTY_RETAIL_CLIENT_FORM_VALUES: NativeRetailClientFormValues = {
  address: '',
  defaultDeliveryFee: '',
  hasReferral: false,
  name: '',
  phone: '',
  referredByName: '',
  sourceType: '',
};
