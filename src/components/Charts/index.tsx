import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FinancialSeriesPoint } from '@/types/data';
import { useAppTheme } from '@/theme';
import { getFinancialChartLabelIndexes, getFinancialChartYCoordinates } from '@/utils/data';

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
  const values = points.map((point) => point.value);
  const yCoordinates = getFinancialChartYCoordinates(values, chartHeight, paddingTop);
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : paddingX + (index / (points.length - 1)) * chartWidth,
    y: yCoordinates[index] ?? paddingTop + chartHeight,
  }));
  const datasetKey = points.map((point) => `${point.key}:${point.value}`).join('|');
  const animationProgress = useSharedValue(0);
  const [animationState, setAnimationState] = useState(() => ({
    datasetKey,
    progress: 0,
  }));
  const updateAnimationState = useCallback(
    (progress: number, nextDatasetKey: string) =>
      setAnimationState({ datasetKey: nextDatasetKey, progress }),
    [],
  );
  useAnimatedReaction(
    () => animationProgress.value,
    (current, previous) => {
      if (current !== previous) runOnJS(updateAnimationState)(current, datasetKey);
    },
    [datasetKey, updateAnimationState],
  );
  useEffect(() => {
    runOnUI(startChartAnimation)(animationProgress);

    return () => cancelAnimation(animationProgress);
  }, [animationProgress, datasetKey]);
  const visibleProgress = animationState.datasetKey === datasetKey ? animationState.progress : 0;
  const visibleCoordinates = getProgressiveCoordinates(coordinates, visibleProgress);
  const linePath = buildSmoothPath(visibleCoordinates);
  const areaPath = buildAreaPath(visibleCoordinates, height - paddingBottom);
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
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => Boolean(onSelectPoint),
        onPanResponderGrant: (event) => {
          if (!onSelectPoint || points.length === 0) return;
          const x = (event.nativeEvent.locationX / Math.max(1, containerWidth)) * width;
          const index = Math.round(((x - paddingX) / chartWidth) * (points.length - 1));
          onSelectPoint(Math.max(0, Math.min(points.length - 1, index)));
        },
        onPanResponderMove: (event) => {
          if (!onSelectPoint || points.length === 0) return;
          const x = (event.nativeEvent.locationX / Math.max(1, containerWidth)) * width;
          const index = Math.round(((x - paddingX) / chartWidth) * (points.length - 1));
          onSelectPoint(Math.max(0, Math.min(points.length - 1, index)));
        },
        onStartShouldSetPanResponder: () => Boolean(onSelectPoint),
      }),
    [chartWidth, containerWidth, onSelectPoint, points.length, width],
  );
  const selectedPoint = selectedIndex === undefined ? undefined : coordinates[selectedIndex];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      onLayout={(event) => setContainerWidth(Math.max(1, event.nativeEvent.layout.width))}
      {...panResponder.panHandlers}
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
        {areaPath ? <Path d={areaPath} fill="url(#financialChartAreaFill)" /> : null}
        {selectedPoint ? (
          <Line
            stroke={strokeColor}
            strokeDasharray="3 4"
            strokeWidth={1}
            x1={selectedPoint.x}
            x2={selectedPoint.x}
            y1={paddingTop}
            y2={height - paddingBottom}
          />
        ) : null}
        <Path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={lineWidth}
        />
        {coordinates.map((point, index) =>
          index <= getLastVisibleMarkerIndex(coordinates.length, visibleProgress) ? (
            <Fragment key={`${point.x}-${point.y}`}>
              <Circle cx={point.x} cy={point.y} fill={strokeColor} r={3.5} />
            </Fragment>
          ) : null,
        )}
        {coordinates.map((point) => (
          <Fragment key={`hit-${point.x}-${point.y}`}>
            <Circle
              cx={point.x}
              cy={point.y}
              fill="transparent"
              onPress={() => onSelectPoint?.(coordinates.indexOf(point))}
              r={14}
            />
          </Fragment>
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
    </View>
  );
}

type ChartCoordinate = { x: number; y: number };

function startChartAnimation(progress: { value: number }) {
  'worklet';

  progress.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
  );
}

function getProgressiveCoordinates(
  coordinates: readonly ChartCoordinate[],
  progress: number,
): ChartCoordinate[] {
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
}

function buildSmoothPath(coordinates: readonly ChartCoordinate[]): string {
  if (coordinates.length === 0) return '';
  if (coordinates.length === 1) return `M ${coordinates[0].x} ${coordinates[0].y}`;

  let path = `M ${coordinates[0].x} ${coordinates[0].y}`;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const previous = coordinates[index - 1] ?? coordinates[index];
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const next = coordinates[index + 2] ?? end;
    const smoothing = 0.75 / 6;
    const controlStart = {
      x: start.x + (end.x - previous.x) * smoothing,
      y: start.y + (end.y - previous.y) * smoothing,
    };
    const controlEnd = {
      x: end.x - (next.x - start.x) * smoothing,
      y: end.y - (next.y - start.y) * smoothing,
    };
    path += ` C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${end.x} ${end.y}`;
  }
  return path;
}

function buildAreaPath(coordinates: readonly ChartCoordinate[], baseline: number): string {
  if (coordinates.length === 0) return '';
  const linePath = buildSmoothPath(coordinates);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return `${linePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

function getLastVisibleMarkerIndex(pointCount: number, progress: number): number {
  if (pointCount <= 1) return pointCount - 1;
  return Math.min(pointCount - 1, Math.floor(progress * (pointCount - 1)));
}
