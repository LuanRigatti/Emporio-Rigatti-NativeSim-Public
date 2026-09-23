import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import {
  NATIVE_MODE_OPTIONS,
  type NativeModeSheetContentProps,
} from './NativeModeSheetContent.types';

export default function NativeModeSheetContent({ mode, onSelect }: NativeModeSheetContentProps) {
  const { resolvedMode, theme } = useAppTheme();
  const capsuleSurface =
    resolvedMode === 'dark' ? theme.colors.contrastSurface : theme.colors.selectionSurface;
  const capsuleContent =
    resolvedMode === 'dark' ? theme.colors.contrastContent : theme.colors.selectionContent;

  return (
    <View style={styles.content}>
      <Text
        style={[
          theme.typography.title2,
          {
            color: theme.colors.textPrimary,
            textAlign: 'center',
            transform: [{ translateY: 20 }],
            width: '100%',
          },
        ]}
      >
        Modo de venda
      </Text>
      <View style={styles.optionsRow}>
        {NATIVE_MODE_OPTIONS.map((option) => {
          const selected = option.mode === mode;

          return (
            <Pressable
              accessibilityLabel={option.title}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.mode}
              onPress={() => {
                if (!selected) triggerLightImpactHaptic();
                onSelect(option.mode);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: capsuleSurface,
                  borderColor: capsuleSurface,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.title3, { color: capsuleContent }]}>
                {option.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  option: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  optionsRow: { flexDirection: 'row', gap: 20, marginHorizontal: 12, marginTop: 64 },
});
