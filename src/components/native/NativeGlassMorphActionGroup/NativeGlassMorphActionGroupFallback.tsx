import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { NativeGlassMorphActionGroupProps } from './NativeGlassMorphActionGroup.types';

const BUTTON_SIZE = 44;
const INNER_SPACING = 2;
const EXPANDED_WIDTH = BUTTON_SIZE * 2 + INNER_SPACING;

export default function NativeGlassMorphActionGroupFallback({
  color,
  isExpanded: controlledExpanded,
  onToggle,
  onSecondaryPress,
  size = 20,
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
    <View
      style={[
        styles.outerContainer,
        {
          height: BUTTON_SIZE,
          minWidth: EXPANDED_WIDTH,
          width: EXPANDED_WIDTH,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.capsuleSurface,
          {
            backgroundColor: theme.colors.glassSurface,
            borderColor: theme.colors.glassBorder,
            gap: INNER_SPACING,
          },
        ]}
      >
        {expanded ? (
          <>
            <Pressable
              accessibilityLabel="Ação secundária"
              accessibilityRole="button"
              onPress={onSecondaryPress}
              style={styles.innerButton}
            >
              <Ionicons color={tintColor} name="add" size={size} />
            </Pressable>
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              onPress={handleToggle}
              style={styles.innerButton}
            >
              <Ionicons color={tintColor} name="close" size={size} />
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityLabel="Mais opções"
            accessibilityRole="button"
            onPress={handleToggle}
            style={styles.innerButton}
          >
            <Ionicons color={tintColor} name="ellipsis-horizontal" size={size} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  capsuleSurface: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: BUTTON_SIZE,
    overflow: 'hidden',
  },
  innerButton: {
    alignItems: 'center',
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE,
  },
  outerContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
