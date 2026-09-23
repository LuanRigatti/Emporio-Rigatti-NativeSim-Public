import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ATTACHMENT_CONTROL_GLASS_TINT,
  BOTTOM_BAR,
  COLORS,
  DURATION,
  EASE_FADE,
  SPRING,
} from '../constants';
import { Glass } from '../glass';
import { SheetBar } from '../panel/sheet-bar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConfirmPillProps {
  count: number;
  active: boolean;
  fade: SharedValue<number>;
  onPress: () => void;
}

function ConfirmPill({ count, active, fade, onPress }: ConfirmPillProps) {
  const hasSelection = count > 0;
  const label = count === 1 ? 'Adicionar 1 foto' : `Adicionar ${count} fotos`;
  const swap = useDerivedValue(() =>
    withTiming(hasSelection ? 1 : 0, { duration: DURATION.pill, easing: EASE_FADE }),
  );
  const plain = useAnimatedStyle(() => ({ opacity: (1 - swap.get()) * fade.get() }));
  const tinted = useAnimatedStyle(() => ({ opacity: swap.get() * fade.get() }));

  const [labelWidth, setLabelWidth] = useState(0);
  const width = useSharedValue(0);
  useEffect(() => {
    if (!labelWidth) return;
    width.set(width.get() === 0 ? labelWidth : withSpring(labelWidth, SPRING.pill));
  }, [labelWidth, width]);
  const sizeStyle = useAnimatedStyle(() => ({
    width: width.get() + BOTTOM_BAR.pillPaddingHorizontal * 2,
  }));

  return (
    <View pointerEvents="box-none" style={styles.pillSlot}>
      <Text
        numberOfLines={1}
        onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
        style={[styles.pillLabel, styles.pillSizer]}
      >
        {hasSelection ? label : 'Todas as fotos'}
      </Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={hasSelection ? label : 'Todas as fotos'}
        disabled={!hasSelection}
        onPress={onPress}
        style={sizeStyle}
      >
        <Glass
          radius={BOTTOM_BAR.pillHeight / 2}
          active={active}
          duration={DURATION.crossfade / 1000}
          tintColor={ATTACHMENT_CONTROL_GLASS_TINT}
          fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}
          style={styles.pill}
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.pillTint, tinted]}
          />
          <Animated.Text numberOfLines={1} style={[styles.pillLabel, styles.pillText, plain]}>
            Todas as fotos
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[styles.pillLabel, styles.pillText, tinted]}>
            {label}
          </Animated.Text>
        </Glass>
      </AnimatedPressable>
    </View>
  );
}

interface PhotoGridBarProps {
  width: number;
  selected: string[];
  active: boolean;
  fade: SharedValue<number>;
  onBack: () => void;
  onConfirm: () => void;
}

export function PhotoGridBar({
  width,
  selected,
  active,
  fade,
  onBack,
  onConfirm,
}: PhotoGridBarProps) {
  return (
    <SheetBar width={width} active={active} fade={fade} onBack={onBack}>
      <ConfirmPill count={selected.length} active={active} fade={fade} onPress={onConfirm} />
    </SheetBar>
  );
}

const styles = StyleSheet.create({
  pillSlot: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pill: {
    height: BOTTOM_BAR.pillHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    color: COLORS.text,
    fontSize: BOTTOM_BAR.pillLabelSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pillTint: {
    borderRadius: BOTTOM_BAR.pillHeight / 2,
    borderCurve: 'continuous',
    backgroundColor: ATTACHMENT_CONTROL_GLASS_TINT,
  },
  pillSizer: {
    position: 'absolute',
    left: 0,
    opacity: 0,
  },
  pillText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
