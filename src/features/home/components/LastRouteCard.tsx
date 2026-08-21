import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
import { NativeTrackedRouteMap } from '@/components/routes';
import { useRouteFuelCost } from '@/hooks/useRouteFuelCost';
import { useAppTheme } from '@/theme';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { formatCurrency } from '@/utils/data';
import { formatRouteDateLabel, formatRouteDistanceLabel } from '../utils/lastRouteFormatUtils';

export { formatRouteDateLabel, formatRouteDistanceLabel };

export type LastRouteCardProps = {
  onPress?: () => void;
  session: RouteTrackingSession | null;
};

export function LastRouteCard({ onPress, session }: LastRouteCardProps) {
  const { theme } = useAppTheme();
  const fuelCost = useRouteFuelCost(session);

  if (!session) return null;

  return (
    <View style={[styles.container, { gap: theme.spacing.md }]}>
      <Pressable
        accessibilityLabel="Abrir última rota na Localização"
        accessibilityRole="button"
        onPress={onPress}
      >
        <View style={styles.header}>
          <Text
            style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}
          >
            Última rota
          </Text>
          <Ionicons
            color={theme.colors.textSecondary}
            name="chevron-forward"
            size={theme.sizes.iconSmall - 2}
            style={{
              marginLeft: theme.spacing.xxs / 2,
              transform: [{ translateY: theme.spacing.xxs / 4 }],
            }}
          />
        </View>
      </Pressable>

      <GlassCard
        accessibilityLabel="Abrir detalhes da última rota"
        elevated
        onPress={onPress}
        style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
      >
        <View pointerEvents="none" style={styles.routePreview}>
          <NativeTrackedRouteMap
            animate={false}
            interactive={false}
            routeId={session.id}
            samples={session.samples}
            style={styles.routePreviewMap}
          />
        </View>
        <View style={styles.routeMeta}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {formatRouteDateLabel(session.date)}
          </Text>
          <View style={styles.routeStatsRow}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {formatRouteDistanceLabel(session.distanceMeters)}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {formatCurrency(fuelCost)}
            </Text>
          </View>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: 0 },
  container: { width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  routeMeta: { gap: 4, padding: 16 },
  routePreview: { height: 180, overflow: 'hidden' },
  routePreviewMap: { flex: 1 },
  routeStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { textAlign: 'center' },
});
