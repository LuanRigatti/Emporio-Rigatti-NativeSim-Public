import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

const FADE_STOPS = [1, 0.94, 0.86, 0.76, 0.65, 0.54, 0.43, 0.33, 0.24, 0.16, 0.08, 0];

export const HISTORY_BOTTOM_FADE_HEIGHT = 64;

/**
 * Uses layered theme-colored views as a dependency-free gradient fallback.
 * The layer is intentionally outside the ScrollView and never receives touches.
 */
export function BottomFadeOverlay() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const fadeHeight = HISTORY_BOTTOM_FADE_HEIGHT + insets.bottom;
  const segmentHeight = fadeHeight / FADE_STOPS.length;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={[styles.overlay, { height: fadeHeight }]}
    >
      {FADE_STOPS.map((opacity, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.segment,
            {
              backgroundColor: theme.colors.background,
              bottom: index * segmentHeight,
              height: segmentHeight,
              opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  segment: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
