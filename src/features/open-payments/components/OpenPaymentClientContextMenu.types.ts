import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { NativeCardContextMenuAction } from '@/components/native';
import type { NativeContextMenuPreviewContent } from 'native-card-context-menu';

export type OpenPaymentClientContextMenuProps = {
  actions: readonly NativeCardContextMenuAction[];
  children: ReactNode;
  identifier: string;
  nativePreview: NativeContextMenuPreviewContent;
  nativePeekPopEnabled: boolean;
  preview: ReactNode;
  style: StyleProp<ViewStyle>;
};
