export type NativeDailyDataValues = {
  estar: string;
  fuelPrice: string;
  kilometers: string;
  other: string;
};

export type NativeDailyDataSheetProps = {
  visible: boolean;
  glassSurface?: boolean;
  initialValues?: NativeDailyDataValues;
  onVisibleChange: (visible: boolean) => void;
  onSubmit: (values: NativeDailyDataValues) => void | Promise<void>;
};
