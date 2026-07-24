import type { FC } from 'react';
import { View } from 'react-native';

import { AppText, Card, Screen } from '@/components';
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

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
          paddingVertical: theme.spacing.xl,
        }}
      >
        <AppText variant="largeTitle">{title}</AppText>
        <AppText style={{ marginTop: theme.spacing.sm, maxWidth: theme.layout.contentMaxWidth }}>
          {description}
        </AppText>
        <Card style={{ marginTop: theme.spacing.xl }}>
          <AppText variant="footnote" style={{ color: theme.colors.textTertiary }}>
            Rota
          </AppText>
          <AppText variant="headline" style={{ marginTop: theme.spacing.xs }}>
            {routeName}
          </AppText>
        </Card>
      </View>
    </Screen>
  );
};
