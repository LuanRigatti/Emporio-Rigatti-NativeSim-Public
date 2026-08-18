import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export type NativeCardContextMenuViewProps = ViewProps & {
  actions: readonly {
    id: string;
    title: string;
    systemImage?: string;
    destructive?: boolean;
    disabled?: boolean;
  }[];
  cornerRadius?: number;
  title?: string;
  onAction?: (event: { nativeEvent: { id: string } }) => void;
};

export const NativeCardContextMenuNativeView: ComponentType<NativeCardContextMenuViewProps> =
  requireNativeView('NativeCardContextMenu');
