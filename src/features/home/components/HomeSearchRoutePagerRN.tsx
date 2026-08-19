import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing, useAppTheme } from '@/theme';
import { NativeTrackedRoutesMap } from '@/components/routes';
import { locationTrackingService } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { selectHomeSearchRouteSessions } from './HomeSearchRoutePreviewAdapter';
import type {
  HomeSearchVisualResult,
  HomeSearchVisualRow,
  HomeSearchVisualSection,
  HomeSearchVisualTone,
} from './HomeSearchResultsVisualModel';

const SEARCH_RESULT_HORIZONTAL_INSET = 16;
const ROUTE_MAP_PREVIEW_HEIGHT = 180;
const monospacedLabelValues = new Set(['Início', 'Fim', 'Duração']);

type Props = {
  cardBackground: string;
  isLarge: boolean;
  items: HomeSearchVisualResult[];
  query?: string;
  topPadding: number;
};

function toneColor(
  tone: HomeSearchVisualTone | undefined,
  theme: ReturnType<typeof useAppTheme>['theme'],
) {
  if (tone === 'success') return theme.colors.success;
  if (tone === 'warning') return theme.colors.warning;
  if (tone === 'info') return theme.colors.info;
  if (tone === 'secondary') return theme.colors.textSecondary;
  return theme.colors.textPrimary;
}

function sfSymbolToIonicons(name?: string): keyof typeof Ionicons.glyphMap {
  if (!name) return 'map-outline';
  if (name.includes('map')) return 'map-outline';
  if (name.includes('calendar')) return 'calendar-outline';
  if (name.includes('clock')) return 'time-outline';
  if (name.includes('speedometer')) return 'speedometer-outline';
  if (name.includes('shippingbox')) return 'cube-outline';
  if (name.includes('chart')) return 'bar-chart-outline';
  if (name.includes('car')) return 'car-outline';
  return 'map-outline';
}

function RoutePreviewMapRN({
  isLarge,
  sessionIds,
}: {
  isLarge: boolean;
  sessionIds: readonly string[];
}) {
  const { theme } = useAppTheme();
  const normalizedIds = React.useMemo(
    () => Array.from(new Set(sessionIds.filter((sessionId) => sessionId.length > 0))),
    [sessionIds],
  );
  const [state, setState] = React.useState<{
    history: RouteTrackingSession[];
    loaded: boolean;
    unavailable: boolean;
  }>({
    history: [],
    loaded: false,
    unavailable: false,
  });

  React.useEffect(() => {
    let cancelled = false;
    void locationTrackingService
      .getRouteHistory()
      .then((history) => {
        if (cancelled) return;
        setState({ history, loaded: true, unavailable: false });
      })
      .catch(() => {
        if (!cancelled) setState({ history: [], loaded: true, unavailable: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = React.useMemo(
    () => selectHomeSearchRouteSessions(state.history, normalizedIds),
    [normalizedIds, state.history],
  );
  const isLoading = normalizedIds.length > 0 && !state.loaded;
  const previewStatus =
    normalizedIds.length === 0 || state.unavailable
      ? 'unavailable'
      : isLoading
        ? 'loading'
        : sessions.length > 0
          ? 'ready'
          : 'unavailable';
  const visibleSessions = React.useMemo(() => (isLoading ? [] : sessions), [isLoading, sessions]);
  const mapRoutes = React.useMemo(
    () =>
      visibleSessions.map((session) => ({
        routeId: session.id,
        samples: session.samples,
      })),
    [visibleSessions],
  );

  return (
    <View
      pointerEvents={isLarge ? 'auto' : 'none'}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.xl + theme.spacing.xs,
        height: ROUTE_MAP_PREVIEW_HEIGHT,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {previewStatus === 'ready' ? (
        <NativeTrackedRoutesMap
          animate={false}
          interactive={isLarge}
          routes={mapRoutes}
          style={{ flex: 1 }}
        />
      ) : previewStatus === 'loading' ? (
        <View style={styles.mapCenter}>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
            Carregando prévia da rota…
          </Text>
        </View>
      ) : (
        <View style={styles.mapCenter}>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
            Prévia da rota indisponível.
          </Text>
        </View>
      )}
    </View>
  );
}

function RoutePageHeader({ query, result }: { query?: string; result: HomeSearchVisualResult }) {
  const { theme } = useAppTheme();
  if (!result.header) return null;
  const context = result.hideQueryContext
    ? undefined
    : (result.context ?? (query !== result.header.title ? query : undefined));

  return (
    <View style={styles.header}>
      {context ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {context}
        </Text>
      ) : null}
      <View style={styles.headerTitleRow}>
        {result.header.systemImage ? (
          <Ionicons
            color={theme.colors.textPrimary}
            name={sfSymbolToIonicons(result.header.systemImage)}
            size={18}
          />
        ) : null}
        <Text
          style={[
            theme.typography.headline,
            styles.headerTitle,
            { color: theme.colors.textPrimary },
          ]}
        >
          {result.header.title}
        </Text>
      </View>
      {result.header.subtitle ? (
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.textSecondary, paddingLeft: 28 },
          ]}
        >
          {result.header.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function RouteValueRow({ row }: { row: HomeSearchVisualRow }) {
  const { theme } = useAppTheme();
  const isMonospaced = row.monospaced || monospacedLabelValues.has(row.label);
  return (
    <View style={styles.row}>
      <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
        {row.label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          styles.rowValue,
          {
            color: toneColor(row.tone, theme),
            fontVariant: isMonospaced ? ['tabular-nums'] : undefined,
            fontWeight: '600',
          },
        ]}
      >
        {row.value}
      </Text>
    </View>
  );
}

function RoutePageSection({
  cardBackground,
  section,
}: {
  cardBackground: string;
  section: HomeSearchVisualSection;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: cardBackground }]}>
      <View style={styles.sectionHeader}>
        <Ionicons
          color={theme.colors.textSecondary}
          name={sfSymbolToIonicons(section.systemImage)}
          size={18}
        />
        <Text style={[theme.typography.headline, { color: theme.colors.textSecondary }]}>
          {section.title}
        </Text>
      </View>
      <View>
        {section.rows.map((row, index) => (
          <React.Fragment key={row.id}>
            <RouteValueRow row={row} />
            {index < section.rows.length - 1 ? (
              <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function HomeSearchRoutePagerRN({
  cardBackground,
  isLarge,
  items,
  query,
  topPadding,
}: Props) {
  const { width } = useWindowDimensions();

  return (
    <ScrollView
      contentContainerStyle={styles.pagerContent}
      horizontal
      nestedScrollEnabled
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.pager}
    >
      {items.map((result) => (
        <View key={result.id} style={[styles.page, { width, paddingTop: topPadding }]}>
          <ScrollView
            contentContainerStyle={styles.scrollPageContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <RoutePageHeader query={query} result={result} />
            {result.route ? (
              <RoutePreviewMapRN isLarge={isLarge} sessionIds={result.route.sessionIds} />
            ) : null}
            {result.sections.map((section) => (
              <RoutePageSection
                cardBackground={cardBackground}
                key={section.id}
                section={section}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  page: {
    flex: 1,
    paddingHorizontal: SEARCH_RESULT_HORIZONTAL_INSET,
  },
  pager: {
    flex: 1,
    width: '100%',
  },
  pagerContent: {
    alignItems: 'stretch',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingVertical: 4,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  scrollPageContent: {
    gap: spacing.md,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 36,
    padding: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
});
