import { MenuView, type MenuAction } from '@expo/ui/community/menu';

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
  title,
}: NativeCardContextMenuProps) {
  return (
    <MenuView
      actions={actions.map(toMenuAction)}
      onPressAction={({ nativeEvent }) => {
        actions.find((action) => action.id === nativeEvent.event)?.onPress();
      }}
      shouldOpenOnLongPress
      title={title}
    >
      {children}
    </MenuView>
  );
}
