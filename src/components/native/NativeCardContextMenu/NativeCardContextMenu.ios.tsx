import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type {
  NativeCardContextMenuAction,
  NativeCardContextMenuProps,
} from './NativeCardContextMenu.types';

const isNativeModuleAvailable = requireOptionalNativeModule('NativeCardContextMenu') !== null;
const NativeView: ComponentType<any> | null = isNativeModuleAvailable
  ? requireNativeView('NativeCardContextMenu')
  : null;

function toMenuAction(action: NativeCardContextMenuAction): MenuAction {
  return {
    id: action.id,
    image: action.systemImage,
    title: action.title,
    attributes: {
      destructive: action.destructive,
      disabled: action.disabled,
    },
  };
}

export default function NativeCardContextMenu({
  actions,
  children,
  cornerRadius = 0,
  style,
  title,
}: NativeCardContextMenuProps) {
  if (NativeView) {
    const rawActions = actions.map((action) => ({
      id: action.id,
      title: action.title,
      systemImage: action.systemImage,
      destructive: action.destructive ?? false,
      disabled: action.disabled ?? false,
    }));

    return (
      <NativeView
        actions={rawActions}
        cornerRadius={cornerRadius}
        onAction={({ nativeEvent }: { nativeEvent: { id: string } }) => {
          actions.find((action) => action.id === nativeEvent.id)?.onPress();
        }}
        style={style}
        title={title}
      >
        {children}
      </NativeView>
    );
  }

  return (
    <MenuView
      actions={actions.map(toMenuAction)}
      onPressAction={({ nativeEvent }) => {
        actions.find((action) => action.id === nativeEvent.event)?.onPress();
      }}
      shouldOpenOnLongPress
      style={style as StyleProp<ViewStyle>}
      title={title}
    >
      {children}
    </MenuView>
  );
}
