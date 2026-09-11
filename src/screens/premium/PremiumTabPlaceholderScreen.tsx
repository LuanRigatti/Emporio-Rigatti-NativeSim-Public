import type { ReactNode } from 'react';
import { View } from 'react-native';

import { GlassHeader, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

export type PremiumTabPlaceholderScreenProps = {
  title: string;
  children?: ReactNode;
};

export function PremiumTabPlaceholderScreen({ title, children }: PremiumTabPlaceholderScreenProps) {
  const { theme } = useAppTheme();

  return (
    <PremiumScreen
      scrollable={false}
      contentContainerStyle={{ paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg }}
    >
      <GlassHeader title={title} />
      <View style={{ flex: 1 }}>{children}</View>
    </PremiumScreen>
  );
}

export function PremiumDashboardPlaceholder() {
  return <PremiumTabPlaceholderScreen title="Dashboard" />;
}

export function PremiumFinancePlaceholder() {
  return <PremiumTabPlaceholderScreen title="Finanças" />;
}

export function PremiumRegisterPlaceholder() {
  return <PremiumTabPlaceholderScreen title="Registrar" />;
}

export function PremiumHistoryPlaceholder() {
  return <PremiumTabPlaceholderScreen title="Histórico" />;
}
