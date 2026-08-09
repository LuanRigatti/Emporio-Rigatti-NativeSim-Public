import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { NativeGlassBackButton } from '@/components/native';
import { NativeTrackedRouteMap } from '@/components/routes';
import { GlassCard, PremiumScreen, Skeleton } from '@/components/premium';
import { locationTrackingService } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';

import { RouteSummaryCard } from './RouteSummaryCard';

export function RouteDetailsScreen() {
  const router = useRouter();
  const { routeId } = useLocalSearchParams<{ routeId?: string | string[] }>();
  const { theme } = useAppTheme();
  const [session, setSession] = useState<RouteTrackingSession | null>(null);
  const [dailyDistanceKilometers, setDailyDistanceKilometers] = useState<number>();
  const [loading, setLoading] = useState(true);
  const id = Array.isArray(routeId) ? routeId[0] : routeId;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      if (!id) {
        setSession(null);
        setDailyDistanceKilometers(undefined);
        setLoading(false);
        return () => {
          active = false;
        };
      }

      void locationTrackingService
        .getRouteSessionById(id)
        .then((nextSession) => {
          if (!active) return;
          setSession(nextSession);
          if (!nextSession) {
            setDailyDistanceKilometers(undefined);
            return;
          }

          return locationTrackingService.getTotalDistanceForDate(nextSession.date).then((value) => {
            if (active) setDailyDistanceKilometers(value);
          });
        })
        .catch(() => {
          if (active) {
            setSession(null);
            setDailyDistanceKilometers(undefined);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [id]),
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Localização"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Detalhes da rota"
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={styles.content}
        overlayHeader={header}
        progressiveBlur
        scrollable
      >
        {loading ? (
          <View style={styles.loading}>
            <Skeleton height={300} />
            <Skeleton height={theme.sizes.loadingLineHeight * 8} />
          </View>
        ) : !session ? (
          <EmptyState
            description="A rota não está mais disponível no histórico local."
            title="Rota não encontrada"
          />
        ) : (
          <View style={[styles.contentGroup, { marginTop: theme.spacing.xl }]}>
            <GlassCard
              style={[styles.mapCard, { borderRadius: theme.radius.xl + theme.spacing.xs }]}
            >
              <NativeTrackedRouteMap
                routeId={session.id}
                samples={session.samples}
                style={styles.map}
              />
            </GlassCard>
            <RouteSummaryCard dailyDistanceKilometers={dailyDistanceKilometers} session={session} />
          </View>
        )}
      </PremiumScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16, paddingBottom: 32 },
  contentGroup: { gap: 16 },
  loading: { gap: 16 },
  map: { flex: 1 },
  mapCard: { height: 300, overflow: 'hidden', padding: 0 },
  root: { flex: 1 },
});
