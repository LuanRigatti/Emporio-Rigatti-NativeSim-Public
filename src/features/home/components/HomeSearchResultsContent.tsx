import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import HomeSearchResultsFallback from './HomeSearchResultsFallback';
import { createHomeSearchResultVisualModel } from './HomeSearchResultsVisualModel';

type Props = {
  isLarge?: boolean;
  loading: boolean;
  response: HomeSearchResponse | null;
  scrollable?: boolean;
};

export default function HomeSearchResultsContent({ loading, response, scrollable = true }: Props) {
  const { theme } = useAppTheme();
  if (!response) {
    return loading ? (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.textSecondary} />
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          Buscando…
        </Text>
      </View>
    ) : (
      <View />
    );
  }
  return (
    <HomeSearchResultsFallback
      model={createHomeSearchResultVisualModel(response)}
      scrollable={scrollable}
    />
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 120 },
});
