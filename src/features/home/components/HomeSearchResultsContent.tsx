import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import { createHomeSearchResultsPresentation } from './HomeSearchResultsPresentation';

type Props = {
  response: HomeSearchResponse | null;
};

export default function HomeSearchResultsContent({ response }: Props) {
  const { theme } = useAppTheme();
  if (!response) return <View />;
  const presentation = createHomeSearchResultsPresentation(response);

  return (
    <View style={[styles.container, { padding: theme.spacing.xl }]}>
      {presentation.empty ? (
        <>
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
            Nenhum resultado
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {presentation.query}
          </Text>
        </>
      ) : (
        <>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {presentation.query}
          </Text>
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
            {presentation.primaryTitle}
          </Text>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
            {presentation.typeLabel}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {presentation.relatedCount}
          </Text>
          {presentation.details?.map((detail) => (
            <Text key={detail} style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {detail}
            </Text>
          ))}
          {presentation.quantity !== undefined ? (
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {presentation.quantity} baldes
            </Text>
          ) : null}
          {presentation.period ? (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {presentation.period}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', gap: 12 },
});
