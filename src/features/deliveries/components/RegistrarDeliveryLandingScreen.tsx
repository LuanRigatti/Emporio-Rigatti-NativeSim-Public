import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { ProgressiveCollapsibleScreen } from '@/components/premium';
import HomeShortcutCard from '@/features/home/components/HomeShortcutCard';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import { wholesaleDeliveryLiveActivityCoordinator } from '@/features/deliveries/liveActivity/LiveActivityCoordinator';
import { useLiveActivityCoordinatorState } from '@/features/deliveries/liveActivity/useLiveActivityCoordinator';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export function RegistrarDeliveryLandingScreen() {
  const { theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const liveActivityState = useLiveActivityCoordinatorState();
  const isLiveActivityActionDisabled =
    liveActivityState.isBusy ||
    liveActivityState.supported !== true ||
    (!liveActivityState.isActive && !liveActivityState.canStart);
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;

  const handleOpenClients = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/registrar-entrega/clientes');
  }, [router]);

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
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityHint={
              liveActivityState.isActive
                ? 'Encerra a Atividade ao vivo das entregas no Atacado'
                : liveActivityState.supported !== true
                  ? 'Disponível em uma Development Build iOS com suporte a Live Activities'
                  : liveActivityState.canStart
                    ? 'Mostra os baldes e as entregas de hoje na Tela Bloqueada e na Dynamic Island'
                    : 'Aguarde uma consulta completa das entregas de hoje'
            }
            accessibilityLabel={
              liveActivityState.isActive
                ? 'Encerrar atividade ao vivo'
                : 'Iniciar atividade ao vivo'
            }
            disabled={isLiveActivityActionDisabled}
            icon="dot.radiowaves.left.and.right"
            onPress={() => {
              if (isLiveActivityActionDisabled) return;
              try {
                triggerLightImpactHaptic();
              } catch {
                // Haptic failure must not block the Live Activity action.
              }
              void wholesaleDeliveryLiveActivityCoordinator.toggleFromToolbar().then((result) => {
                if (!result.ok) Alert.alert('Atividade ao vivo', result.message);
              });
            }}
            selected={liveActivityState.isActive}
            separateBackground={false}
            tintColor={theme.colors.textPrimary}
          />
        </Stack.Toolbar>
      ) : null}
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
