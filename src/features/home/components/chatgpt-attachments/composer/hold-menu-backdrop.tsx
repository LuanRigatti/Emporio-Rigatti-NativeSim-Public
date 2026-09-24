import { ProgressiveBlurView } from 'expo-backdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { HOLD_MENU_LAYOUT, HOLD_MENU_PALETTE } from './hold-menu.constants';

interface HoldMenuBackdropProps {
  fadeHeight: number;
  holdHeight: number;
}

export const HoldMenuBackdrop = memo(function HoldMenuBackdrop({
  fadeHeight,
  holdHeight,
}: HoldMenuBackdropProps) {
  const { resolvedMode } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const palette = HOLD_MENU_PALETTE[resolvedMode];
  const riseHeight = fadeHeight + holdHeight;
  const seamColors = [
    palette.seam,
    palette.seamSoft,
    palette.seamMid,
    palette.seamPeak,
    palette.seamMid,
    palette.seamSoft,
    palette.seam,
  ] as const;

  return (
    <View pointerEvents="none" style={styles.root}>
      <ScrollView
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={styles.anchor}
        contentContainerStyle={{ height: windowHeight * 3 }}
        contentOffset={{ x: 0, y: windowHeight }}
      />
      <View style={styles.column}>
        <ProgressiveBlurView
          edge="bottom"
          intensity={HOLD_MENU_LAYOUT.backdropIntensity}
          startOffset={holdHeight / riseHeight}
          tint={
            resolvedMode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
          }
          tintColor={palette.wash}
          scrollFallback={false}
          style={{ height: riseHeight }}
        />
        <View style={styles.fall}>
          <ProgressiveBlurView
            edge="top"
            intensity={HOLD_MENU_LAYOUT.backdropIntensity}
            tint={
              resolvedMode === 'dark'
                ? 'systemUltraThinMaterialDark'
                : 'systemUltraThinMaterialLight'
            }
            tintColor={palette.wash}
            scrollFallback={false}
            style={StyleSheet.absoluteFill}
          />
          {Platform.OS === 'android' ? (
            <LinearGradient
              colors={[palette.seamPeak, palette.seamMid, palette.seamSoft, palette.seam]}
              locations={[0, 0.35, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
      </View>
      <LinearGradient
        colors={seamColors}
        locations={[0, 0.2, 0.38, 0.5, 0.62, 0.8, 1]}
        style={[
          styles.seam,
          { top: riseHeight - HOLD_MENU_LAYOUT.seamFade, height: HOLD_MENU_LAYOUT.seamFade * 2 },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  anchor: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  column: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  fall: { flex: 0.6 },
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
});
