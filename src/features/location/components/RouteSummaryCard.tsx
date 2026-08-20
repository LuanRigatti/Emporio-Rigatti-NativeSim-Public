import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
import HistorySymbolIcon from '@/features/history/components/HistorySymbolIcon';
import { useRouteFuelCost } from '@/hooks/useRouteFuelCost';
import { useAppTheme } from '@/theme';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { formatCurrency } from '@/utils/data';

type Props = {
  dailyDistanceKilometers?: number;
  session: RouteTrackingSession;
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${weekday} ${day}/${month}/${year}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
}

function formatKilometers(kilometers: number): string {
  return `${kilometers.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} km`;
}

function formatDistance(meters: number): string {
  return formatKilometers(meters / 1000);
}

export function RouteSummaryCard({ dailyDistanceKilometers, session }: Props) {
  const { theme } = useAppTheme();
  const fuelCost = useRouteFuelCost(session);
  const sessionDistanceKilometers = session.distanceMeters / 1000;
  const showDailyDistance =
    dailyDistanceKilometers !== undefined &&
    formatKilometers(dailyDistanceKilometers) !== formatKilometers(sessionDistanceKilometers);
  const rows = [
    { icon: 'calendar', label: 'Data', value: formatDate(session.startTimestamp) },
    { icon: 'play.circle', label: 'Início', value: formatTime(session.startTimestamp) },
    { icon: 'flag.circle', label: 'Fim', value: formatTime(session.endTimestamp) },
    { icon: 'timer', label: 'Duração', value: formatDuration(session.durationSeconds) },
    {
      icon: 'point.3.connected.trianglepath.dotted',
      label: 'Distância',
      value: formatDistance(session.distanceMeters),
    },
    {
      icon: 'fuelpump',
      label: 'Valor gasto',
      value: formatCurrency(fuelCost),
    },
    ...(!showDailyDistance
      ? []
      : [
          {
            icon: 'road.lanes',
            label: 'Km considerado no dia',
            value: formatKilometers(dailyDistanceKilometers),
          },
        ]),
  ];

  return (
    <GlassCard
      style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.xs, padding: 0 }]}
    >
      <View style={[styles.cards, { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm }]}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={[
              styles.row,
              {
                minHeight: theme.sizes.touchTargetMinimum + theme.spacing.xs,
              },
            ]}
          >
            <View style={styles.labelGroup}>
              <HistorySymbolIcon
                color={theme.colors.textSecondary}
                fallbackIcon="information-circle-outline"
                size={theme.sizes.iconSmall}
                systemName={row.icon}
              />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                {row.label}
              </Text>
            </View>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cards: { width: '100%' },
  card: { width: '100%' },
  labelGroup: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 8 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
});
