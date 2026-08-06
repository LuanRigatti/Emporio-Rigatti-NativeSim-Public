export type NativeDailyDataValues = {
  estar: string;
  fuelPrice: string;
  kilometers: string;
  other: string;
};

export type NativeDailyDataSheetProps = {
  visible: boolean;
  initialValues?: NativeDailyDataValues;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeDailyDataValues) => void | Promise<void>;
};
