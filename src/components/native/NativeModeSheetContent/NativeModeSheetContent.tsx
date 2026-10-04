import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import {
  NATIVE_MODE_OPTIONS,
  type NativeModeSheetContentProps,
} from './NativeModeSheetContent.types';

export default function NativeModeSheetContent({ mode, onSelect }: NativeModeSheetContentProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.content}>
      <Text
        style={[
          theme.typography.title2,
          {
            color: theme.colors.textPrimary,
            textAlign: 'center',
            transform: [{ translateY: 16 }],
            width: '100%',
          },
        ]}
      >
        Modo de venda
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        {NATIVE_MODE_OPTIONS.map((option, index) => {
          const selected = option.mode === mode;
          const modeIcons =
            option.mode === 'wholesale'
              ? ({ active: 'cube', inactive: 'cube-outline' } as const)
              : ({ active: 'bag', inactive: 'bag-outline' } as const);
          const iconName = modeIcons[selected ? 'active' : 'inactive'];

          return (
            <Fragment key={option.mode}>
              <Pressable
                accessibilityLabel={option.title}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (!selected) triggerLightImpactHaptic();
                  onSelect(option.mode);
                }}
                style={({ pressed }) => [styles.option, { opacity: pressed ? 0.82 : 1 }]}
              >
                <Ionicons
                  color={selected ? theme.colors.contrastSurface : theme.colors.textSecondary}
                  name={iconName}
                  size={20}
                />
                <Text
                  style={[
                    theme.typography.title3,
                    { color: theme.colors.textPrimary, fontWeight: fonts.weight.regular },
                  ]}
                >
                  {option.title}
                </Text>
                <View style={styles.spacer} />
              </Pressable>
              {index < NATIVE_MODE_OPTIONS.length - 1 ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.separator, { backgroundColor: theme.colors.separator }]}
                />
              ) : null}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 32 },
  card: { overflow: 'hidden' },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 40, marginRight: 16 },
  spacer: { flex: 1 },
});
