import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import type { StyleProp, ViewStyle } from 'react-native';

import type {
  NativeCardContextMenuAction,
  NativeCardContextMenuProps,
} from './NativeCardContextMenu.types';

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
  style,
  title,
}: NativeCardContextMenuProps) {
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
