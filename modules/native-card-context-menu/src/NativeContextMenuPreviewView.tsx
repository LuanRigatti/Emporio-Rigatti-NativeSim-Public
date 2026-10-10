import type { ComponentType } from 'react';
import { View } from 'react-native';

import type { NativeContextMenuPreviewViewProps } from './NativeContextMenuPreview.types';

export const NativeContextMenuPreviewView: ComponentType<NativeContextMenuPreviewViewProps> = ({
  actions: _actions,
  identifier: _identifier,
  menuTitle: _menuTitle,
  onAction: _onAction,
  presentationStyle: _presentationStyle,
  preview: _preview,
  ...viewProps
}) => <View {...viewProps} />;
