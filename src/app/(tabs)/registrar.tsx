import { StyleSheet, useColorScheme, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import { NativeBottomSheet, NativeGlassActionGroup } from '@/components/native';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { addHistoryDelivery } from '@/features/history/data/historyDeliveryStore';

export default function PrototypeRegistrar() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [sheetVisible, setSheetVisible] = useState(false);
  const dark = colorScheme === 'dark';
  const [sheetMode, setSheetMode] = useState<'add' | 'remove'>('add');
  const openSheet = (mode: 'add' | 'remove') => {
    triggerLightImpactHaptic();
    setSheetMode(mode);
    setSheetVisible(true);
  };
  const handleConfirm = (confirmation: Parameters<typeof addHistoryDelivery>[0]) => {
    const delivery = addHistoryDelivery(confirmation);
    setSheetVisible(false);
    router.push({ pathname: '/(tabs)/historico', params: { date: delivery.data } });
  };

  return (
    <View style={[styles.screen, { backgroundColor: dark ? '#000000' : '#FFFFFF' }]}>
      <NativeGlassHeader
        includeTopSafeArea
        leftActions={<View style={styles.headerActionSpacer} />}
        mode="transparent"
        rightActions={
          <NativeGlassActionGroup
            color={dark ? '#FFFFFF' : '#000000'}
            leadingAccessibilityLabel="Adicionar"
            leadingFallbackIcon="add"
            leadingSystemImage="plus"
            onLeadingPress={() => openSheet('add')}
            onTrailingPress={() => openSheet('remove')}
            trailingAccessibilityLabel="Excluir"
            trailingFallbackIcon="trash-outline"
            trailingSystemImage="trash"
          />
        }
        title="Registrar"
      />
      <NativeBottomSheet
        items={[
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
        ]}
        onVisibleChange={setSheetVisible}
        onConfirm={handleConfirm}
        title={sheetMode === 'remove' ? 'Remover entrega' : 'Adicionar entrega'}
        titleSystemImage={sheetMode === 'remove' ? 'trash' : 'plus'}
        subtitle="Escolha o cliente"
        visible={sheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerActionSpacer: { width: 112 },
});
