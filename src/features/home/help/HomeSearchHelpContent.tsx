import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { HOME_SEARCH_HELP_CATEGORIES } from './HomeSearchHelpData';
import type { SearchHelpCategory, SearchHelpExample } from './HomeSearchHelpTypes';

type Props = {
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
          paddingVertical: theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.exampleTextContainer}>
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.textPrimary, fontWeight: '500' },
          ]}
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

function HelpCategorySection({
  category,
  onSelect,
}: {
  category: SearchHelpCategory;
  onSelect: (query: string) => void;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.categorySection}>
      <View
        style={[
          styles.categoryHeader,
          { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
        ]}
      >
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textSecondary, fontWeight: '600' },
          ]}
        >
          {category.title.toUpperCase()}
        </Text>
      </View>
      <View
        style={[
          styles.categoryCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.separator,
            borderRadius: 36,
          },
        ]}
      >
        {category.examples.map((example, index) => (
          <View key={example.id}>
            {index > 0 ? (
              <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
            ) : null}
            <HelpExampleRow example={example} onSelect={onSelect} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function HomeSearchHelpContent({ onSelectQuery }: Props) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        {
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
        },
      ]}
      showsVerticalScrollIndicator
    >
      {HOME_SEARCH_HELP_CATEGORIES.map((category) => (
        <HelpCategorySection category={category} key={category.id} onSelect={onSelectQuery} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 6,
  },
  categorySection: {
    gap: 4,
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
