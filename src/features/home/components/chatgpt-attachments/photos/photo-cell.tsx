import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { COLORS, GRID, SPRING } from '../constants';
import type { LibraryPhoto } from './use-photo-library';

export function slotSize(width: number) {
  return width / GRID.columns;
}

interface CellProps {
  photo: LibraryPhoto;
  slot: number;
  order: number;
  lifted: boolean;
  onPress: (photo: LibraryPhoto) => void;
}

export const PhotoCell = memo(function PhotoCell({
  photo,
  slot,
  order,
  lifted,
  onPress,
}: CellProps) {
  const selected = order > 0;
  const progress = useDerivedValue(() => withSpring(selected ? 1 : 0, SPRING.badge));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.4, 1]) }],
  }));

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityState={{ selected }}
      onPress={() => onPress(photo)}
      style={{ width: slot, height: slot, opacity: lifted ? 0 : 1 }}
    >
      <View style={styles.cell}>
        <Image
          source={photo.id}
          recyclingKey={photo.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Animated.View pointerEvents="none" style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeLabel}>{selected ? order : ''}</Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: GRID.gap,
    bottom: GRID.gap,
    borderRadius: GRID.cellRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.photoFill,
  },
  badge: {
    position: 'absolute',
    right: GRID.badgeInset + GRID.gap,
    bottom: GRID.badgeInset + GRID.gap,
    width: GRID.badgeSize,
    height: GRID.badgeSize,
    borderRadius: GRID.badgeSize / 2,
    borderWidth: GRID.badgeRing,
    borderColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  badgeLabel: {
    color: COLORS.text,
    fontSize: GRID.badgeLabelSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
