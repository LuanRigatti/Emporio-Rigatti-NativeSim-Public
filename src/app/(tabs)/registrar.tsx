import { useCallback, useEffect, useSyncExternalStore, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeBottomSheet,
  NativeGlassActionGroup,
  NativeSequentialBottomSheet,
} from '@/components/native';
import type { NativeBottomSheetItem } from '@/components/native';
import { AnimatedPressable, PremiumCard, PremiumScreen } from '@/components/premium';
import { ENABLE_NATIVE_SEQUENTIAL_REGISTRO_SHEET } from '@/config/featureFlags';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import {
  addHistoryDelivery,
  getAddedHistoryDeliveries,
  subscribeToAddedHistoryDeliveries,
  removeAddedHistoryDeliveries,
  updateAddedHistoryDeliveryQuantity,
} from '@/features/history/data/historyDeliveryStore';

const BUCKET_PRICE = 49.8;

const REGISTRO_CLIENT_ITEMS = [
  { id: 'joao', title: 'João Silva', systemImage: 'person.crop.circle.fill' },
  { id: 'maria', title: 'Maria Oliveira', systemImage: 'person.crop.circle.fill' },
  { id: 'pedro', title: 'Pedro Santos', systemImage: 'person.crop.circle.fill' },
  { id: 'ana', title: 'Ana Costa', systemImage: 'person.crop.circle.fill' },
  { id: 'lucas', title: 'Lucas Ferreira', systemImage: 'person.crop.circle.fill' },
  { id: 'beatriz', title: 'Beatriz Martins', systemImage: 'person.crop.circle.fill' },
  { id: 'carlos', title: 'Carlos Souza', systemImage: 'person.crop.circle.fill' },
  { id: 'juliana', title: 'Juliana Alves', systemImage: 'person.crop.circle.fill' },
  { id: 'rafael', title: 'Rafael Lima', systemImage: 'person.crop.circle.fill' },
  { id: 'sofia', title: 'Sofia Rocha', systemImage: 'person.crop.circle.fill' },
] as const;

export default function PrototypeRegistrar() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const [isSelectionMode, setSelectionMode] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const dark = colorScheme === 'dark';
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<NativeBottomSheetItem | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number | undefined>(undefined);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectionProgress = useSharedValue(0);
  useEffect(() => {
    selectionProgress.value = withSpring(
      isSelectionMode ? 1 : 0,
      theme.animations.spring.responsive,
    );
  }, [isSelectionMode, selectionProgress, theme.animations.spring.responsive]);
  const selectionIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    marginRight: selectionProgress.value * 12,
    opacity: selectionProgress.value,
    width: selectionProgress.value * 24,
  }));
  const deliveries = useSyncExternalStore(
    subscribeToAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
  );
  useFocusEffect(
    useCallback(
      () => () => {
        setSelectionMode(false);
        setSelectedDeliveryIds(new Set());
      },
      [setSelectionMode],
    ),
  );
  const openSheet = () => {
    triggerLightImpactHaptic();
    setSheetMode('add');
    setEditingDeliveryId(null);
    setEditingItem(null);
    setEditingQuantity(undefined);
    setSheetVisible(true);
  };
  const handleConfirm = (confirmation: Parameters<typeof addHistoryDelivery>[0]) => {
    if (editingDeliveryId) {
      updateAddedHistoryDeliveryQuantity(
        editingDeliveryId,
        confirmation.quantity,
        confirmation.bucketPrice,
      );
    } else {
      addHistoryDelivery(confirmation);
    }
    setEditingDeliveryId(null);
    setEditingItem(null);
    setEditingQuantity(undefined);
    setSheetVisible(false);
  };
  const handleTopMenuPress = useCallback(() => {
    triggerLightImpactHaptic();
    setSelectedDeliveryIds(new Set());
    setSelectionMode((current) => !current);
  }, []);
  const handleDeleteSelected = useCallback(() => {
    triggerLightImpactHaptic();
    removeAddedHistoryDeliveries(selectedDeliveryIds);
    setSelectedDeliveryIds(new Set());
    setSelectionMode(false);
  }, [selectedDeliveryIds]);
  const handleEditSelected = useCallback(() => {
    if (selectedDeliveryIds.size !== 1) return;

    const deliveryId = [...selectedDeliveryIds][0];
    const delivery = deliveries.find((item) => item.id === deliveryId);
    if (!delivery) return;

    triggerLightImpactHaptic();
    const item = REGISTRO_CLIENT_ITEMS.find(
      (candidate) => candidate.title === delivery.cliente,
    ) ?? {
      id: delivery.id,
      title: delivery.cliente,
      systemImage: 'person.crop.circle.fill',
    };
    setEditingDeliveryId(delivery.id);
    setEditingItem(item);
    setEditingQuantity(delivery.quantidadeBaldes);
    setSheetMode('edit');
    setSelectedDeliveryIds(new Set());
    setSelectionMode(false);
    setSheetVisible(true);
  }, [deliveries, selectedDeliveryIds]);
  const handleSheetVisibleChange = useCallback((visible: boolean) => {
    setSheetVisible(visible);
    if (!visible) {
      setEditingDeliveryId(null);
      setEditingItem(null);
      setEditingQuantity(undefined);
      setSheetMode('add');
    }
  }, []);
  const toggleDeliverySelection = useCallback((deliveryId: string) => {
    setSelectedDeliveryIds((current) => {
      const next = new Set(current);
      if (next.has(deliveryId)) {
        next.delete(deliveryId);
      } else {
        next.add(deliveryId);
      }
      return next;
    });
  }, []);

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      leftActions={
        isSelectionMode ? (
          <Animated.View
            entering={FadeInLeft.duration(theme.animations.duration.slow).easing(
              theme.animations.easing.entrance,
            )}
            style={styles.headerLeadingActions}
          >
            <NativeGlassActionGroup
              color={dark ? '#FFFFFF' : '#000000'}
              leadingAccessibilityLabel="Editar quantidade"
              leadingFallbackIcon="create-outline"
              leadingSystemImage="pencil"
              onLeadingPress={handleEditSelected}
              onTrailingPress={handleDeleteSelected}
              trailingAccessibilityLabel="Excluir selecionados"
              trailingFallbackIcon="trash-outline"
              trailingSystemImage="trash"
            />
          </Animated.View>
        ) : (
          <View style={styles.headerActionSpacer} />
        )
      }
      mode="transparent"
      pointerEvents="box-none"
      rightActions={
        <NativeGlassActionGroup
          color={dark ? '#FFFFFF' : '#000000'}
          leadingAccessibilityLabel="Adicionar"
          leadingFallbackIcon="add"
          leadingSystemImage="plus"
          onLeadingPress={openSheet}
          onTrailingPress={handleTopMenuPress}
          trailingAccessibilityLabel="Selecionar entregas"
          trailingFallbackIcon="ellipsis-horizontal"
          trailingSystemImage="ellipsis"
        />
      }
      title="Registrar"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: dark ? '#000000' : theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl,
          paddingHorizontal: 0,
        }}
        overlayHeader={header}
        progressiveBlur
      >
        <View style={[styles.deliveryList, { gap: theme.spacing.sm }]}>
          {deliveries.length > 0 ? (
            <PremiumCard
              style={[styles.deliveryCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              {[...deliveries].reverse().map((delivery) => (
                <AnimatedPressable
                  key={delivery.id}
                  onPress={isSelectionMode ? () => toggleDeliverySelection(delivery.id) : undefined}
                  style={styles.deliveryRow}
                >
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {formatDeliveryDate(delivery.data)}
                  </Text>
                  <View style={styles.deliverySummary}>
                    <View style={styles.deliveryLeading}>
                      <Animated.View
                        style={[
                          styles.selectionIndicator,
                          selectionIndicatorAnimatedStyle,
                          {
                            backgroundColor: selectedDeliveryIds.has(delivery.id)
                              ? theme.colors.selectionSurface
                              : 'transparent',
                            borderColor: selectedDeliveryIds.has(delivery.id)
                              ? theme.colors.selectionSurface
                              : theme.colors.borderStrong,
                          },
                        ]}
                      >
                        {selectedDeliveryIds.has(delivery.id) ? (
                          <Text
                            style={[
                              styles.selectionCheck,
                              { color: theme.colors.selectionContent },
                            ]}
                          >
                            ✓
                          </Text>
                        ) : null}
                      </Animated.View>
                      <View style={styles.deliveryInfo}>
                        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                          {delivery.cliente}
                        </Text>
                        <Text
                          style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                        >
                          {delivery.quantidadeBaldes}{' '}
                          {delivery.quantidadeBaldes === 1 ? 'balde' : 'baldes'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                      {delivery.valor}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </PremiumCard>
          ) : null}
        </View>
      </PremiumScreen>
      {ENABLE_NATIVE_SEQUENTIAL_REGISTRO_SHEET ? (
        <NativeSequentialBottomSheet
          bucketPrice={BUCKET_PRICE}
          items={REGISTRO_CLIENT_ITEMS}
          onConfirm={handleConfirm}
          onVisibleChange={handleSheetVisibleChange}
          initialQuantity={editingQuantity}
          initialSelectedItem={editingItem}
          initialStep={editingItem ? 'form' : 'list'}
          title={sheetMode === 'edit' ? 'Editar entrega' : 'Adicionar entrega'}
          titleSystemImage={sheetMode === 'edit' ? 'pencil' : 'plus'}
          subtitle="Escolha o cliente"
          visible={sheetVisible}
        />
      ) : (
        <NativeBottomSheet
          bucketPrice={BUCKET_PRICE}
          items={REGISTRO_CLIENT_ITEMS}
          onConfirm={handleConfirm}
          onVisibleChange={handleSheetVisibleChange}
          initialQuantity={editingQuantity}
          presentationStep={editingItem ? 'form' : undefined}
          selectedItem={editingItem}
          title={sheetMode === 'edit' ? 'Editar entrega' : 'Adicionar entrega'}
          titleSystemImage={sheetMode === 'edit' ? 'pencil' : 'plus'}
          subtitle="Escolha o cliente"
          visible={sheetVisible}
        />
      )}
    </View>
  );
}

function formatDeliveryDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerActionSpacer: { width: 112 },
  headerLeadingActions: { alignItems: 'flex-start', width: 112 },
  deliveryList: { paddingHorizontal: 16, paddingTop: 24 },
  deliveryCard: { gap: 8 },
  deliveryRow: { gap: 8, paddingVertical: 8 },
  deliverySummary: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  deliveryLeading: { alignItems: 'center', flexDirection: 'row' },
  deliveryInfo: { gap: 2 },
  selectionIndicator: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    marginRight: 12,
    width: 24,
  },
  selectionCheck: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
});
