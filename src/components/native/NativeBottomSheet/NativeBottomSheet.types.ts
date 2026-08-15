import type { ReactNode } from 'react';

export type NativeBottomSheetItem = {
  id: string;
  title: string;
  subtitle?: string;
  systemImage?: string;
  bucketPrice?: number;
};

export type NativeBottomSheetDetent = 'medium' | 'large' | { fraction: number };

export type NativeBottomSheetConfirmation = {
  client: NativeBottomSheetItem;
  date: Date;
  quantity: number;
  bucketPrice: number;
};

export type NativeBottomSheetProps = {
  content?: ReactNode;
  hostSizing?: 'content' | 'fill' | 'viewport';
  detents?: readonly NativeBottomSheetDetent[];
  visible: boolean;
  bucketPrice?: number;
  title: string;
  titleSystemImage?: string;
  subtitle?: string;
  items: readonly NativeBottomSheetItem[];
  onDismiss?: () => void;
  onImplementationReady?: (implementation: 'swiftui' | 'fallback') => void;
  onVisibleChange: (visible: boolean) => void;
  onSelect?: (item: NativeBottomSheetItem) => void;
  onPageSettled?: (page: number) => void;
  onConfirm?: (confirmation: NativeBottomSheetConfirmation) => void;
  onDetentChange?: (detent: NativeBottomSheetDetent) => void;
  selectedItem?: NativeBottomSheetItem | null;
  initialQuantity?: number;
  initialDetent?: NativeBottomSheetDetent;
};
