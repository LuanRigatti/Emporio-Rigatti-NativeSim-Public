import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { NativeGlassMorphActionGroupProps } from './NativeGlassMorphActionGroup.types';

export default function NativeGlassMorphActionGroupFallback({
  color,
  isExpanded: controlledExpanded,
  onToggle,
  onSecondaryPress,
  size = 20,
  spacing = 8,
  style,
}: NativeGlassMorphActionGroupProps) {
  const { theme } = useAppTheme();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const next = !expanded;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalExpanded(next);
    }
  };

  const tintColor = color ?? theme.colors.textPrimary;

  return (
    <View style={[styles.container, { gap: spacing }, style]}>
      <Pressable
        accessibilityLabel={expanded ? 'Fechar' : 'Mais opções'}
        accessibilityRole="button"
        onPress={handleToggle}
        style={[
          styles.button,
          {
            backgroundColor: theme.colors.glassSurface,
            borderColor: theme.colors.glassBorder,
          },
        ]}
      >
        <Ionicons color={tintColor} name={expanded ? 'close' : 'ellipsis-horizontal'} size={size} />
      </Pressable>

      {expanded ? (
        <Pressable
          accessibilityLabel="Ação secundária"
          accessibilityRole="button"
          onPress={onSecondaryPress}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.glassSurface,
              borderColor: theme.colors.glassBorder,
            },
          ]}
        >
          <Ionicons color={tintColor} name="add" size={size} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  container: {
    flexDirection: 'row',
  },
});
