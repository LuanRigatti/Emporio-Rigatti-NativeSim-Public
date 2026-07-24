import type { ReactNode } from 'react';
import { Modal as NativeModal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

export type ModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

export function Modal({ visible, onRequestClose, children }: ModalProps) {
  return (
    <NativeModal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Fechar modal"
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </NativeModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.elevated,
  },
});
