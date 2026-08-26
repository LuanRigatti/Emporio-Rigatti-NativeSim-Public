import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { FinancialSeriesPoint } from '@/types/data';
import { useAppTheme } from '@/theme';
import { getFinancialChartLabelIndexes, getFinancialChartYCoordinates } from '@/utils/data';
import { triggerSelectionHaptic } from '@/utils/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  points: readonly FinancialSeriesPoint[];
  accessibilityLabel: string;
  color?: string;
  lineWidth?: number;
  onSelectPoint?: (index: number) => void;
  selectedIndex?: number;
  showAllLabels?: boolean;
};

export function FinancialSeriesChart({
  accessibilityLabel,
  color,
  lineWidth = 3,
  onSelectPoint,
  points,
  selectedIndex,
  showAllLabels = false,
}: Props) {
  const { theme } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(360);
  const width = 360;
  const height = 220;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 36;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const values = useMemo(() => points.map((point) => point.value), [points]);
  const yCoordinates = useMemo(
    () => getFinancialChartYCoordinates(values, chartHeight, paddingTop),
    [chartHeight, paddingTop, values],
  );
  const coordinates = useMemo(
    () =>
      points.map((_, index) => ({
        x: points.length === 1 ? width / 2 : paddingX + (index / (points.length - 1)) * chartWidth,
        y: yCoordinates[index] ?? paddingTop + chartHeight,
      })),
    [chartHeight, chartWidth, paddingTop, points, width, yCoordinates],
  );
  const datasetKey = useMemo(
    () => points.map((point) => `${point.key}:${point.value}`).join('|'),
    [points],
  );
  const animationProgress = useSharedValue(0);
  useEffect(() => {
    runOnUI(startChartAnimation)(animationProgress);

    return () => cancelAnimation(animationProgress);
  }, [animationProgress, datasetKey]);

  const selectedPoint = selectedIndex === undefined ? undefined : coordinates[selectedIndex];
  const initialX = selectedPoint?.x ?? coordinates[0]?.x ?? width / 2;
  const initialY = selectedPoint?.y ?? coordinates[0]?.y ?? paddingTop + chartHeight / 2;

  const scrubX = useSharedValue(initialX);
  const scrubY = useSharedValue(initialY);
  const containerWidthShared = useSharedValue(360);
  const isInteracting = useSharedValue(false);

  useEffect(() => {
    if (selectedPoint && !isInteracting.value) {
      runOnUI(snapScrubPosition)(scrubX, scrubY, selectedPoint.x, selectedPoint.y);
    }
  }, [isInteracting, scrubX, scrubY, selectedPoint]);

  const animatedLineProps = useAnimatedProps(() => {
    'worklet';

    const getVisibleCoordinates = (progress: number): ChartCoordinate[] => {
      if (coordinates.length <= 1 || progress >= 1) return [...coordinates];
      if (progress <= 0) return coordinates.length > 0 ? [coordinates[0]] : [];

      const position = progress * (coordinates.length - 1);
      const endIndex = Math.floor(position);
      const segmentProgress = position - endIndex;
      if (segmentProgress === 0) return coordinates.slice(0, endIndex + 1);

      const start = coordinates[endIndex];
      const end = coordinates[endIndex + 1];
      return [
        ...coordinates.slice(0, endIndex + 1),
        {
          x: start.x + (end.x - start.x) * segmentProgress,
          y: start.y + (end.y - start.y) * segmentProgress,
        },
      ];
    };
    const buildSmoothPath = (visibleCoordinates: readonly ChartCoordinate[]): string => {
      if (visibleCoordinates.length === 0) return '';
      if (visibleCoordinates.length === 1) {
        return `M ${visibleCoordinates[0].x} ${visibleCoordinates[0].y}`;
      }

      let path = `M ${visibleCoordinates[0].x} ${visibleCoordinates[0].y}`;
      for (let index = 0; index < visibleCoordinates.length - 1; index += 1) {
        const previous = visibleCoordinates[index - 1] ?? visibleCoordinates[index];
        const start = visibleCoordinates[index];
        const end = visibleCoordinates[index + 1];
        const next = visibleCoordinates[index + 2] ?? end;
        const smoothing = 0.75 / 6;
        const controlStartX = start.x + (end.x - previous.x) * smoothing;
        const controlStartY = start.y + (end.y - previous.y) * smoothing;
        const controlEndX = end.x - (next.x - start.x) * smoothing;
        const controlEndY = end.y - (next.y - start.y) * smoothing;
        path += ` C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${end.x} ${end.y}`;
      }
      return path;
    };

    return { d: buildSmoothPath(getVisibleCoordinates(animationProgress.value)) };
  });
  const animatedAreaProps = useAnimatedProps(() => {
    'worklet';

    const getVisibleCoordinates = (progress: number): ChartCoordinate[] => {
      if (coordinates.length <= 1 || progress >= 1) return [...coordinates];
      if (progress <= 0) return coordinates.length > 0 ? [coordinates[0]] : [];

      const position = progress * (coordinates.length - 1);
      const endIndex = Math.floor(position);
      const segmentProgress = position - endIndex;
      if (segmentProgress === 0) return coordinates.slice(0, endIndex + 1);

      const start = coordinates[endIndex];
      const end = coordinates[endIndex + 1];
      return [
        ...coordinates.slice(0, endIndex + 1),
        {
          x: start.x + (end.x - start.x) * segmentProgress,
          y: start.y + (end.y - start.y) * segmentProgress,
        },
      ];
    };
    const buildSmoothPath = (visibleCoordinates: readonly ChartCoordinate[]): string => {
      if (visibleCoordinates.length === 0) return '';
      if (visibleCoordinates.length === 1) {
        return `M ${visibleCoordinates[0].x} ${visibleCoordinates[0].y}`;
      }

      let path = `M ${visibleCoordinates[0].x} ${visibleCoordinates[0].y}`;
      for (let index = 0; index < visibleCoordinates.length - 1; index += 1) {
        const previous = visibleCoordinates[index - 1] ?? visibleCoordinates[index];
        const start = visibleCoordinates[index];
        const end = visibleCoordinates[index + 1];
        const next = visibleCoordinates[index + 2] ?? end;
        const smoothing = 0.75 / 6;
        const controlStartX = start.x + (end.x - previous.x) * smoothing;
        const controlStartY = start.y + (end.y - previous.y) * smoothing;
        const controlEndX = end.x - (next.x - start.x) * smoothing;
        const controlEndY = end.y - (next.y - start.y) * smoothing;
        path += ` C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${end.x} ${end.y}`;
      }
      return path;
    };

    const visibleCoordinates = getVisibleCoordinates(animationProgress.value);
    if (visibleCoordinates.length === 0) return { d: '' };

    const linePath = buildSmoothPath(visibleCoordinates);
    const first = visibleCoordinates[0];
    const last = visibleCoordinates[visibleCoordinates.length - 1];
    return {
      d: `${linePath} L ${last.x} ${height - paddingBottom} L ${first.x} ${height - paddingBottom} Z`,
    };
  });
  const gridColor = theme.colors.separator;
  const textColor = theme.colors.textSecondary;
  const strokeColor = color ?? theme.colors.primary;
  const areaColor = theme.colors.textPrimary;
  const maxLabels = Math.max(2, Math.floor((Math.max(360, containerWidth) - paddingX * 2) / 56));
  const labelIndexes = useMemo(
    () =>
      showAllLabels
        ? Array.from({ length: points.length }, (_, index) => index)
        : getFinancialChartLabelIndexes(points.length, maxLabels),
    [maxLabels, points.length, showAllLabels],
  );

  const handleTouchAt = useCallback(
    (locationX: number) => {
      if (!onSelectPoint || coordinates.length === 0) return;

      if (coordinates.length === 1) {
        runOnUI(setScrubPosition)(scrubX, scrubY, coordinates[0].x, coordinates[0].y);
        if (selectedIndex !== 0) {
          triggerSelectionHaptic();
          onSelectPoint(0);
        }
        return;
      }

      const viewBoxX = (locationX / Math.max(1, containerWidth)) * width;
      const firstX = coordinates[0].x;
      const lastX = coordinates[coordinates.length - 1].x;
      const clampedX = Math.max(firstX, Math.min(lastX, viewBoxX));
      const interpolatedY = interpolateYOnCoordinates(clampedX, coordinates);

      runOnUI(setScrubPosition)(scrubX, scrubY, clampedX, interpolatedY);

      const nearestIndex = getNearestIndexForX(clampedX, coordinates);
      if (nearestIndex !== selectedIndex) {
        triggerSelectionHaptic();
        onSelectPoint(nearestIndex);
      }
    },
    [containerWidth, coordinates, onSelectPoint, scrubX, scrubY, selectedIndex, width],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(onSelectPoint))
        .minDistance(0)
        .activeOffsetX([-2, 2])
        .cancelsTouchesInView(true)
        .onBegin((event) => {
          'worklet';
          setSharedFlag(isInteracting, true);
          runOnJS(handleTouchAt)(event.x);
        })
        .onUpdate((event) => {
          'worklet';
          runOnJS(handleTouchAt)(event.x);
        })
        .onEnd(() => {
          'worklet';
          setSharedFlag(isInteracting, false);
          if (selectedPoint) {
            snapScrubPosition(scrubX, scrubY, selectedPoint.x, selectedPoint.y);
          }
        })
        .onFinalize(() => {
          'worklet';
          setSharedFlag(isInteracting, false);
          if (selectedPoint) {
            snapScrubPosition(scrubX, scrubY, selectedPoint.x, selectedPoint.y);
          }
        }),
    [handleTouchAt, isInteracting, onSelectPoint, scrubX, scrubY, selectedPoint],
  );

  const animatedLineStyle = useAnimatedStyle(() => {
    const pixelX = (scrubX.value / 360) * containerWidthShared.value;
    return {
      opacity: selectedIndex === undefined ? 0 : 1,
      transform: [{ translateX: pixelX }],
    };
  });

  const animatedMarkerStyle = useAnimatedStyle(() => {
    const pixelX = (scrubX.value / 360) * containerWidthShared.value;
    const pixelY = scrubY.value;
    return {
      opacity: selectedIndex === undefined ? 0 : 1,
      transform: [{ translateX: pixelX - 6 }, { translateY: pixelY - 6 }],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        onLayout={(event) => {
          const measured = Math.max(1, event.nativeEvent.layout.width);
          setContainerWidth(measured);
          containerWidthShared.value = measured;
        }}
        style={styles.root}
      >
        <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
          <Defs>
            <LinearGradient id="financialChartAreaFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={areaColor} stopOpacity={0.14} />
              <Stop offset="1" stopColor={areaColor} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((fraction) => {
            const y = paddingTop + fraction * chartHeight;
            return (
              <Line
                key={fraction}
                stroke={gridColor}
                strokeDasharray="4 5"
                strokeWidth={1}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
              />
            );
          })}
          <AnimatedPath
            animatedProps={animatedAreaProps}
            fill="url(#financialChartAreaFill)"
          />
          <AnimatedPath
            animatedProps={animatedLineProps}
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={lineWidth}
          />
          {coordinates.map((point, index) => (
            <AnimatedChartMarker
              color={strokeColor}
              index={index}
              key={`${point.x}-${point.y}`}
              point={point}
              pointCount={coordinates.length}
              progress={animationProgress}
            />
          ))}
          {labelIndexes.map((index) => {
            const point = points[index];
            return (
              <SvgText
                fill={textColor}
                fontSize={11}
                key={point.key}
                textAnchor="middle"
                x={coordinates[index].x}
                y={height - 12}
              >
                {point.label}
              </SvgText>
            );
          })}
        </Svg>
        <View pointerEvents="none" style={styles.overlay}>
          <Animated.View
            style={[styles.indicatorLine, { borderColor: strokeColor }, animatedLineStyle]}
          />
          <Animated.View
            style={[
              styles.markerDot,
              {
                backgroundColor: strokeColor,
                borderColor: theme.colors.surface,
              },
              animatedMarkerStyle,
            ]}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

type AnimatedChartMarkerProps = {
  color: string;
  index: number;
  point: ChartCoordinate;
  pointCount: number;
  progress: SharedValue<number>;
};

function AnimatedChartMarker({ color, index, point, pointCount, progress }: AnimatedChartMarkerProps) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: pointCount <= 1 || progress.value >= index / (pointCount - 1) ? 1 : 0,
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={point.x}
      cy={point.y}
      fill={color}
      r={3.5}
    />
  );
}

type ChartCoordinate = { x: number; y: number };

function interpolateYOnCoordinates(
  scrubX: number,
  coordinates: readonly ChartCoordinate[],
): number {
  if (coordinates.length === 0) return 0;
  if (coordinates.length === 1) return coordinates[0].y;

  const firstX = coordinates[0].x;
  const lastX = coordinates[coordinates.length - 1].x;
  const clampedX = Math.max(firstX, Math.min(lastX, scrubX));

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    if (clampedX >= p1.x && clampedX <= p2.x) {
      const segmentWidth = p2.x - p1.x;
      if (segmentWidth === 0) return p1.y;
      const t = (clampedX - p1.x) / segmentWidth;
      return p1.y + (p2.y - p1.y) * t;
    }
  }

  return coordinates[coordinates.length - 1].y;
}

function getNearestIndexForX(scrubX: number, coordinates: readonly ChartCoordinate[]): number {
  if (coordinates.length <= 1) return 0;
  let nearestIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i < coordinates.length; i++) {
    const dist = Math.abs(coordinates[i].x - scrubX);
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}

function setScrubPosition(
  scrubX: { value: number },
  scrubY: { value: number },
  x: number,
  y: number,
) {
  'worklet';

  scrubX.value = x;
  scrubY.value = y;
}
function setSharedFlag(flag: { value: boolean }, value: boolean) {
  'worklet';

  flag.value = value;
}

function snapScrubPosition(
  scrubX: { value: number },
  scrubY: { value: number },
  targetX: number,
  targetY: number,
) {
  'worklet';

  scrubX.value = withTiming(targetX, {
    duration: 160,
    easing: Easing.out(Easing.quad),
  });
  scrubY.value = withTiming(targetY, {
    duration: 160,
    easing: Easing.out(Easing.quad),
  });
}

function startChartAnimation(progress: { value: number }) {
  'worklet';

  progress.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
  );
}

const styles = StyleSheet.create({
  root: {
    height: 220,
    position: 'relative',
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  indicatorLine: {
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    bottom: 36,
    left: 0,
    position: 'absolute',
    top: 20,
    width: 1,
  },
  markerDot: {
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 12,
  },
});
