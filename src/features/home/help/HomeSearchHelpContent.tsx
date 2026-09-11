import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { getHomeSearchHelpSuggestions } from './HomeSearchHelpData';
import type { SearchHelpExample } from './HomeSearchHelpTypes';

type Props = {
  cardBackground?: string;
  onSelectQuery: (query: string) => void;
};

function HelpExampleRow({
  example,
  onSelect,
}: {
  example: SearchHelpExample;
  onSelect: (query: string) => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={example.label}
      accessibilityRole="button"
      onPress={() => {
        triggerLightImpactHaptic();
        onSelect(example.query);
      }}
      style={({ pressed }) => [
        styles.exampleRow,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          paddingLeft: theme.spacing.xl,
          paddingRight: theme.spacing.md,
          paddingVertical: theme.spacing.xl,
        },
      ]}
    >
      <View style={styles.exampleTextContainer}>
        <Text
          style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '500' }]}
        >
          {example.label}
        </Text>
        {example.description ? (
          <Text
            style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}
          >
            {example.description}
          </Text>
        ) : null}
      </View>
      <Ionicons color={theme.colors.textTertiary} name="search-outline" size={16} />
    </Pressable>
  );
}

export default function HomeSearchHelpContent({ cardBackground, onSelectQuery }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const suggestions = getHomeSearchHelpSuggestions();

  return (
    <View
      style={[
        styles.scrollContainer,
        {
          paddingBottom: theme.spacing.xxxl,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xxxl,
        },
      ]}
    >
      <View
        style={[
          styles.suggestionsCard,
          {
            backgroundColor:
              cardBackground ?? getCardSurfaceColor(resolvedMode, theme.colors.surface),
            borderColor: theme.colors.separator,
            borderRadius: 40,
            borderWidth: theme.borders.width.thin,
          },
          resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
        ]}
      >
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <View key={suggestion.id}>
            {index > 0 ? (
              <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
            ) : null}
            <HelpExampleRow example={suggestion} onSelect={onSelectQuery} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionsCard: {
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 24,
  },
  exampleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exampleTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  scrollContainer: {
    flexGrow: 1,
  },
});
