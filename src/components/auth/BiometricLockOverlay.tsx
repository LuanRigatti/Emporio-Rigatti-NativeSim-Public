import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type BiometricLockOverlayProps = {
  onRetry: () => void;
  showRetry: boolean;
  visible: boolean;
};

export function BiometricLockOverlay({ visible, showRetry, onRetry }: BiometricLockOverlayProps) {
  const { resolvedMode, theme } = useAppTheme();

  if (!visible) return null;

  return (
    <View accessibilityViewIsModal style={styles.root}>
      <BlurView
        intensity={100}
        tint={resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.background, opacity: 0.32 },
        ]}
      />
      {showRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente com Face ID"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: theme.colors.textInverse }]}>
            Tentar novamente
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  button: {
    borderRadius: 14,
    minWidth: 190,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
