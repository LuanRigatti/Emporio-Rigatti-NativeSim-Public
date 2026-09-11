import type { ComponentType } from 'react';
import { View } from 'react-native';

import type { NativeCardContextMenuViewProps } from './NativeCardContextMenuView.ios';

export const NativeCardContextMenuNativeView: ComponentType<NativeCardContextMenuViewProps> = (
  props,
) => <View {...props} />;
