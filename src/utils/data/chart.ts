export function getFinancialChartLabelIndexes(pointCount: number, maxLabels: number): number[] {
  if (pointCount <= 0) return [];
  if (pointCount <= maxLabels) return Array.from({ length: pointCount }, (_, index) => index);
  const indexes = new Set<number>([0, pointCount - 1]);
  const step = (pointCount - 1) / (maxLabels - 1);
  for (let index = 1; index < maxLabels - 1; index += 1) {
    indexes.add(Math.round(index * step));
  }
  return [...indexes].sort((left, right) => left - right);
}

export function getFinancialChartYCoordinates(
  values: readonly number[],
  chartHeight: number,
  paddingTop: number,
): number[] {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values.map((value) => paddingTop + (1 - (value - min) / range) * chartHeight);
}
