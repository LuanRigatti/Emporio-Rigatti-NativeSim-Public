import type { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export type NavigationPlaceholderProps = {
  title?: string;
  routeName?: string;
  description?: string;
};

export const NavigationPlaceholder: FC<NavigationPlaceholderProps> = ({
  title = 'Tela provisória',
  routeName = 'Modal',
  description = 'Tela provisória para validação da navegação',
}) => {
  const { theme } = useAppTheme();
  const { colors, typography, spacing, radius, borders, shadows, layout } = theme;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: layout.screenHorizontalPadding,
            paddingVertical: spacing.xl,
          },
        ]}
      >
        <Text style={[typography.largeTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text
          style={[
            typography.body,
            styles.description,
            {
              color: colors.textSecondary,
              marginTop: spacing.sm,
              maxWidth: layout.contentMaxWidth,
            },
          ]}
        >
          {description}
        </Text>

        <View
          style={[
            styles.card,
            shadows.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.separator,
              borderRadius: radius.lg,
              borderWidth: borders.width.thin,
              marginTop: spacing.xl,
              padding: spacing.lg,
            },
          ]}
        >
          <Text style={[typography.footnote, { color: colors.textTertiary }]}>Rota</Text>
          <Text
            accessibilityRole="text"
            style={[typography.headline, { color: colors.textPrimary, marginTop: spacing.xs }]}
          >
            {routeName}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  description: {
    flexShrink: 1,
  },
  card: {
    alignSelf: 'stretch',
  },
});
