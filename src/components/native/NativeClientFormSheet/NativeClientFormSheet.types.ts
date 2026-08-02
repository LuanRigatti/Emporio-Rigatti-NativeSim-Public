export type NativeClientFormValues = {
  name: string;
  address: string;
  bucketPrice: string;
};

export type NativeClientFormSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeClientFormValues) => Promise<void>;
  title?: string;
};
