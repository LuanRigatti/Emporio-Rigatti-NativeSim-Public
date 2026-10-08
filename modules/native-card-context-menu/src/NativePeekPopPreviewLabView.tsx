import type { ComponentType } from 'react';
import { Text, View } from 'react-native';

import type { NativePeekPopPreviewLabViewProps } from './NativeContextMenuPreview.types';

export const NativePeekPopPreviewLabView: ComponentType<NativePeekPopPreviewLabViewProps> = ({
  actions: _actions,
  identifier: _identifier,
  menuTitle: _menuTitle,
  onAction: _onAction,
  onClose: _onClose,
  onOpen: _onOpen,
  preview: _preview,
  secondaryCard: _secondaryCard,
  ...viewProps
}) => (
  <View {...viewProps} accessibilityRole="summary">
    <Text>Prévia nativa disponível somente no iOS.</Text>
  </View>
);
