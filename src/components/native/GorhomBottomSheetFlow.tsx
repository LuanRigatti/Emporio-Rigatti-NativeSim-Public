import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from './NativeBottomSheet';

type GorhomBottomSheetFlowProps = {
  items: readonly NativeBottomSheetItem[];
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onConfirm?: (confirmation: NativeBottomSheetConfirmation) => void;
};

/**
 * Future native bottom-sheet flow. Keep this file out of Expo Go imports until
 * a Development Build containing @gorhom/bottom-sheet is available.
 */
export function GorhomBottomSheetFlow({
  items,
  visible,
  onVisibleChange,
  onConfirm,
}: GorhomBottomSheetFlowProps) {
  const snapPoints = useMemo(() => ['54%'], []);
  const [isFirstOpen, setIsFirstOpen] = useState(visible);
  const [isSecondOpen, setIsSecondOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const pendingClient = useRef<NativeBottomSheetItem | null>(null);
  const presentationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsFirstOpen(visible);
    if (!visible) {
      setIsSecondOpen(false);
      setSelectedClient(null);
      pendingClient.current = null;
    }
  }, [visible]);

  useEffect(
    () => () => {
      if (presentationTimer.current) clearTimeout(presentationTimer.current);
    },
    [],
  );

  const handleFirstClose = useCallback(() => {
    setIsFirstOpen(false);
    if (!pendingClient.current) {
      onVisibleChange(false);
      return;
    }

    presentationTimer.current = setTimeout(() => {
      presentationTimer.current = null;
      setIsSecondOpen(true);
    }, 380);
  }, [onVisibleChange]);

  const handleSelect = useCallback((item: NativeBottomSheetItem) => {
    pendingClient.current = item;
    setSelectedClient(item);
    setIsFirstOpen(false);
  }, []);

  const handleSecondClose = useCallback(() => {
    setIsSecondOpen(false);
    pendingClient.current = null;
    setSelectedClient(null);
    onVisibleChange(false);
  }, [onVisibleChange]);

  return (
    <>
      <BottomSheet
        enablePanDownToClose
        index={isFirstOpen ? 0 : -1}
        onClose={handleFirstClose}
        snapPoints={snapPoints}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Adicionar entrega</Text>
          <Text style={styles.subtitle}>Escolha o cliente</Text>
          {items.map((item) => (
            <Pressable key={item.id} onPress={() => handleSelect(item)} style={styles.row}>
              <View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle ?? 'Selecionar'}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet
        enablePanDownToClose
        index={isSecondOpen ? 0 : -1}
        onClose={handleSecondClose}
        snapPoints={snapPoints}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Adicionar entrega</Text>
          <Text style={styles.itemTitle}>{selectedClient?.title}</Text>
          <Text style={styles.itemSubtitle}>Formulário de entrega</Text>
          <Pressable
            onPress={() => {
              if (selectedClient) {
                onConfirm?.({
                  bucketPrice: 49.8,
                  client: selectedClient,
                  date: new Date(),
                  quantity: 1,
                });
              }
              handleSecondClose();
            }}
            style={styles.confirmButton}
          >
            <Text style={styles.confirmLabel}>Confirmar</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 20 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#777777', fontSize: 15, fontWeight: '600' },
  row: {
    alignItems: 'center',
    borderBottomColor: '#dddddd',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemTitle: { fontSize: 17, fontWeight: '600' },
  itemSubtitle: { color: '#777777', fontSize: 14 },
  chevron: { color: '#777777', fontSize: 28 },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#1683ff',
    borderRadius: 24,
    padding: 14,
  },
  confirmLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
