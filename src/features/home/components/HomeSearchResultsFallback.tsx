import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  HomeSearchResultVisualModel,
  HomeSearchVisualResult,
  HomeSearchVisualRow,
  HomeSearchVisualSection,
  HomeSearchVisualTone,
} from './HomeSearchResultsVisualModel';

type Props = {
  model: HomeSearchResultVisualModel;
};

function ResultHeader({ query, result }: { query?: string; result: HomeSearchVisualResult }) {
  const { theme } = useAppTheme();
  const { text: maskText } = useTestModePresentation();
  if (!result.header) return null;
  const context = result.hideQueryContext
    ? undefined
    : (result.context ?? (query !== result.header.title ? query : undefined));
  return (
    <View style={styles.header}>
      {context ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {maskText(context)}
        </Text>
      ) : null}
      <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
        {result.header.title}
      </Text>
      {result.header.subtitle ? (
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
        {maskText(result.header.subtitle)}
        </Text>
      ) : null}
    </View>
  );
}

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

function ResultMetric({ metric }: { metric: NonNullable<HomeSearchResultVisualModel['metric']> }) {
  const { theme } = useAppTheme();
  const { text: maskText } = useTestModePresentation();
  return (
    <View style={styles.metric}>
      <Text style={[theme.typography.metricLarge, { color: toneColor(metric.tone, theme) }]}>
        {maskText(metric.value)}
      </Text>
      {metric.label ? (
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {metric.label}
        </Text>
      ) : null}
    </View>
  );
}

function ResultValueRow({ row }: { row: HomeSearchVisualRow }) {
  const { theme } = useAppTheme();
  const { text: maskText } = useTestModePresentation();
  return (
    <View style={styles.row}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {row.label}
      </Text>
      <Text style={[theme.typography.body, styles.rowValue, { color: toneColor(row.tone, theme) }]}>
        {maskText(row.value)}
      </Text>
    </View>
  );
}

function ResultSection({ section }: { section: HomeSearchVisualSection }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        {section.title}
      </Text>
      <View style={styles.rows}>
        {section.rows.map((row) => (
          <ResultValueRow key={row.id} row={row} />
        ))}
      </View>
    </View>
  );
}

function ResultState({ result }: { result: HomeSearchVisualResult }) {
  const { theme } = useAppTheme();
  if (!result.state) return null;
  return (
    <View style={styles.state}>
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        {result.state.title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {result.state.description}
      </Text>
    </View>
  );
}

function ResultContent({ query, result }: { query?: string; result: HomeSearchVisualResult }) {
  return (
    <View style={styles.result}>
      <ResultHeader query={query} result={result} />
      {result.metric ? <ResultMetric metric={result.metric} /> : null}
      {result.state ? <ResultState result={result} /> : null}
      {result.sections.map((section) => (
        <ResultSection key={section.id} section={section} />
      ))}
    </View>
  );
}

export default function HomeSearchResultsFallback({ model }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {model.empty ? (
        <ResultState result={model} />
      ) : (
        model.items.map((result) => (
          <ResultContent key={result.id} query={model.query} result={result} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  metric: { gap: 4 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  result: { gap: 20 },
  rows: { gap: 4 },
  scrollContent: { gap: 20, padding: 24, paddingBottom: 32 },
  section: { gap: 8 },
  state: { alignItems: 'center', gap: 8, paddingVertical: 12 },
});
