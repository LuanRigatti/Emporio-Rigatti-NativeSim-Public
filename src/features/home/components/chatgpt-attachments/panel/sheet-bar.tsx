import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { AttachmentIcon } from '../AttachmentIcon';
import { BOTTOM_BAR, COLORS, DURATION, GUTTER } from '../constants';
import { Glass } from '../glass';

interface SheetBarProps {
  width: number;
  active: boolean;
  fade: SharedValue<number>;
  onBack: () => void;
  children: ReactNode;
}

export function SheetBar({ width, active, fade, onBack, children }: SheetBarProps) {
  const backStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    <View pointerEvents={active ? 'box-none' : 'none'} style={[styles.bar, { width }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao menu" onPress={onBack}>
        <Glass
          radius={BOTTOM_BAR.controlSize / 2}
          active={active}
          duration={DURATION.crossfade / 1000}
          style={styles.back}
        >
          <Animated.View style={backStyle}>
            <AttachmentIcon name="chevron-left" size={BOTTOM_BAR.backIcon} color={COLORS.text} />
          </Animated.View>
        </Glass>
      </Pressable>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: GUTTER,
    bottom: GUTTER + BOTTOM_BAR.inset,
    height: BOTTOM_BAR.controlSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BOTTOM_BAR.inset,
  },
  back: {
    width: BOTTOM_BAR.controlSize,
    height: BOTTOM_BAR.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
