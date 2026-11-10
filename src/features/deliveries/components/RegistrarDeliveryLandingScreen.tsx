import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter, type NativeStackNavigationProp } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { ProgressiveCollapsibleScreen } from '@/components/premium';
import HomeShortcutCard from '@/features/home/components/HomeShortcutCard';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import {
  usePendingReturnNavigationIntent,
  useReleaseNavigationGuardOnWebReturn,
} from '@/utils/navigation/usePendingReturnNavigationIntent';

export function RegistrarDeliveryLandingScreen() {
  const { theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const isOpeningClientsRef = useRef(false);
  const requestNavigationIntent = usePendingReturnNavigationIntent({
    expectedOutgoingRouteNames: ['registrar-entrega/clientes'],
    navigation,
    sourceRouteName: 'registrar-entrega',
  });
  const releaseWebReturnGuard = useCallback(() => {
    if (!isOpeningClientsRef.current) return;
    isOpeningClientsRef.current = false;
  }, []);
  useReleaseNavigationGuardOnWebReturn(releaseWebReturnGuard);
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;

  useEffect(
    () =>
      navigation.addListener('transitionEnd', ({ data }) => {
        if (data.closing && isOpeningClientsRef.current) isOpeningClientsRef.current = false;
      }),
    [navigation],
  );

  const handleOpenClients = useCallback(() => {
    if (isOpeningClientsRef.current) {
      return;
    }

    const decision = requestNavigationIntent({
      key: 'registrar_clients',
      execute: (deferred) => {
        if (isOpeningClientsRef.current) return;
        isOpeningClientsRef.current = true;
        if (!deferred) triggerLightImpactHaptic();
        router.push('/registrar-entrega/clientes');
      },
    });

    if (decision === 'pending') triggerLightImpactHaptic();
  }, [requestNavigationIntent, router]);

  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Entrega"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Entrega"
        contentGap={0}
        contentTopInset={contentTopInset}
        largeTitle={largeTitle}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl,
          paddingHorizontal: 0,
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.layout.screenHorizontalPadding,
            paddingTop: theme.spacing.md,
            width: '100%',
          }}
        >
          <HomeShortcutCard
            accessibilityLabel="Abrir clientes para registrar entrega"
            icon={<Ionicons color={theme.colors.textSecondary} name="person-outline" size={21} />}
            label="Clientes"
            onPress={handleOpenClients}
            trailing={
              <Ionicons
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={theme.sizes.iconMedium}
              />
            }
          />
        </View>
      </ProgressiveCollapsibleScreen>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
