import { Link } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Alert, ActionSheetIOS, Platform, Pressable } from 'react-native';

import type { NativeMenuProps } from '@/types/native-ui';

function showSystemMenu({ actions, title }: NativeMenuProps): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: actions.map((action) => action.title),
        title,
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex((action) => action.destructive),
        disabledButtonIndices: actions.flatMap((action, index) => (action.disabled ? [index] : [])),
      },
      (index) => {
        const action = actions[index];
        if (action && !action.disabled) {
          action.onPress();
        }
      },
    );
    return;
  }

  const firstAction = actions.find((action) => !action.disabled);
  if (firstAction) {
    Alert.alert(title ?? 'Opções', actions.map((action) => action.title).join('\n'), [
      { text: 'Cancelar', style: 'cancel' },
      { text: firstAction.title, onPress: firstAction.onPress },
    ]);
  }
}

export default function NativeMenuExpo({
  accessibilityLabel,
  actions,
  children,
  href,
  title,
}: NativeMenuProps) {
  if (Platform.OS === 'ios' && href) {
    return (
      <Link href={href} asChild>
        <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button">
          {children}
        </Pressable>
        <Link.Menu title={title}>
          {actions.map((action) => (
            <Link.MenuAction
              destructive={action.destructive}
              disabled={action.disabled}
              icon={action.systemImage as SFSymbol | undefined}
              isOn={action.isOn}
              key={action.id}
              onPress={action.onPress}
              title={action.title}
            />
          ))}
        </Link.Menu>
      </Link>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => showSystemMenu({ actions, children, href, title, accessibilityLabel })}
    >
      {children}
    </Pressable>
  );
}
