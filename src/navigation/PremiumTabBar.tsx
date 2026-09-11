import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';

import { GlassTabBar, type GlassTabBarItem } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { PremiumMainTabParamList } from './types';

const tabIcons: Record<keyof PremiumMainTabParamList, GlassTabBarItem['icon']> = {
  Dashboard: 'home',
  Financeiro: 'stats-chart',
  Registrar: 'add-circle',
  Historico: 'time-outline',
};

const tabLabels: Record<keyof PremiumMainTabParamList, string> = {
  Dashboard: 'Dashboard',
  Financeiro: 'Finanças',
  Registrar: 'Registrar',
  Historico: 'Histórico',
};

export function PremiumTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { theme } = useAppTheme();

  const items: GlassTabBarItem[] = state.routes.map((route, index) => {
    const routeName = route.name as keyof PremiumMainTabParamList;
    const options = descriptors[route.key]?.options;
    const focused = state.index === index;

    return {
      key: route.key,
      label: options?.tabBarLabel?.toString() ?? tabLabels[routeName],
      icon: tabIcons[routeName],
      selected: focused,
      onPress: () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      },
    };
  });

  return (
    <View
      style={[
        styles.wrapper,
        {
          pointerEvents: 'box-none',
          paddingBottom: insets.bottom + theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
        },
      ]}
    >
      <GlassTabBar items={items} accessibilityLabel="Navegação principal" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
});
