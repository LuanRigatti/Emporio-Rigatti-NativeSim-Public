export type NativeBottomSheetItem = {
  id: string;
  title: string;
  subtitle?: string;
  systemImage?: string;
};

export type NativeBottomSheetConfirmation = {
  client: NativeBottomSheetItem;
  date: Date;
  quantity: number;
};

export type NativeBottomSheetProps = {
  visible: boolean;
  title: string;
  titleSystemImage?: string;
  subtitle?: string;
  items: readonly NativeBottomSheetItem[];
  onVisibleChange: (visible: boolean) => void;
  onSelect?: (item: NativeBottomSheetItem) => void;
  onConfirm?: (confirmation: NativeBottomSheetConfirmation) => void;
};
