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
  summary?: {
    label: string;
    value: string;
    subtitle?: string;
  };
  sections?: readonly NativeContextMenuPreviewSection[];
};

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
  children?: ReactNode;
  onAction?: (event: NativeContextMenuActionEvent) => void;
  onOpen?: (event: NativeContextMenuOpenEvent) => void;
};

export type NativePeekPopPreviewLabViewProps = ViewProps & {
  identifier: string;
  preview: NativeContextMenuPreviewContent;
  actions: readonly NativeContextMenuAction[];
  menuTitle?: string;
  onAction?: (event: NativeContextMenuActionEvent) => void;
  onOpen?: (event: NativeContextMenuOpenEvent) => void;
  onClose?: (event: NativePeekPopPreviewLabCloseEvent) => void;
};
