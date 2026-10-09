import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

export type NativeContextMenuPreviewRow = {
  id?: string;
  title: string;
  subtitle?: string;
  value?: string;
  systemImage?: string;
};

export type NativeContextMenuPreviewSection = {
  id?: string;
  title?: string;
  rows: readonly NativeContextMenuPreviewRow[];
};

export type NativeContextMenuPreviewContent = {
  title: string;
  subtitle?: string;
  leadingSystemImage?: string;
  appearance?: {
    pageBackgroundColor?: string;
    cardSurfaceColor?: string;
  };
  summary?: {
    label: string;
    value: string;
    subtitle?: string;
  };
  sections?: readonly NativeContextMenuPreviewSection[];
};

export type NativeContextMenuPreviewPresentationStyle =
  'page' | 'expandedPanel' | 'interactiveViewer';

export type NativeContextMenuAction = {
  id: string;
  title: string;
  systemImage?: string;
  destructive?: boolean;
  disabled?: boolean;
};

export type NativeContextMenuActionEvent = {
  nativeEvent: {
    identifier: string;
    actionId: string;
  };
};

export type NativeContextMenuOpenEvent = {
  nativeEvent: {
    identifier: string;
    preview: NativeContextMenuPreviewContent;
  };
};

export type NativePeekPopPreviewLabCloseEvent = {
  nativeEvent: {
    identifier: string;
  };
};

export type NativeContextMenuPreviewViewProps = ViewProps & {
  identifier: string;
  preview: NativeContextMenuPreviewContent;
  actions: readonly NativeContextMenuAction[];
  menuTitle?: string;
  presentationStyle?: NativeContextMenuPreviewPresentationStyle;
  children?: ReactNode;
  onAction?: (event: NativeContextMenuActionEvent) => void;
  onOpen?: (event: NativeContextMenuOpenEvent) => void;
};

export type NativeOpenPaymentContextMenuHostViewProps = ViewProps & {
  active: boolean;
  children?: ReactNode;
};

export type NativePeekPopPreviewLabCard = {
  title: string;
  identifier: string;
  preview: NativeContextMenuPreviewContent;
  actions: readonly NativeContextMenuAction[];
  menuTitle?: string;
  presentationStyle?: NativeContextMenuPreviewPresentationStyle;
};

export type NativePeekPopPreviewLabViewProps = ViewProps & {
  identifier: string;
  preview: NativeContextMenuPreviewContent;
  actions: readonly NativeContextMenuAction[];
  menuTitle?: string;
  secondaryCard?: NativePeekPopPreviewLabCard;
  onAction?: (event: NativeContextMenuActionEvent) => void;
  onOpen?: (event: NativeContextMenuOpenEvent) => void;
  onClose?: (event: NativePeekPopPreviewLabCloseEvent) => void;
};
