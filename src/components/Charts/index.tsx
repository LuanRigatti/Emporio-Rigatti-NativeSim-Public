import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { FinancialSeriesPoint } from '@/types/data';
import { useAppTheme } from '@/theme';
import { getFinancialChartLabelIndexes } from '@/utils/data';

type Props = {
  points: readonly FinancialSeriesPoint[];
  accessibilityLabel: string;
  color?: string;
};

export function FinancialSeriesChart({ points, accessibilityLabel, color }: Props) {
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
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : paddingX + (index / (points.length - 1)) * chartWidth,
    y: paddingTop + (1 - (point.value - min) / range) * chartHeight,
  }));
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const gridColor = theme.colors.separator;
  const textColor = theme.colors.textSecondary;
  const strokeColor = color ?? theme.colors.primary;
  const maxLabels = Math.max(2, Math.floor((containerWidth - paddingX * 2) / 56));
  const labelIndexes = useMemo(
    () => getFinancialChartLabelIndexes(points.length, maxLabels),
    [maxLabels, points.length],
  );

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      onLayout={(event) => setContainerWidth(Math.max(360, event.nativeEvent.layout.width))}
    >
      <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
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
        <Polyline fill="none" points={polyline} stroke={strokeColor} strokeWidth={3} />
        {coordinates.map((point) => (
          <Circle
            cx={point.x}
            cy={point.y}
            fill={theme.colors.surface}
            key={`${point.x}-${point.y}`}
            r={5}
            stroke={strokeColor}
            strokeWidth={3}
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
    </View>
  );
}
