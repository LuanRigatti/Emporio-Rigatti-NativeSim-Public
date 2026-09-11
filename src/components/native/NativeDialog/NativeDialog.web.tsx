import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeDialogProps } from '@/types/native-ui';

export default function NativeDialogWeb({
  actions,
  message,
  onDismiss,
  title,
  visible,
}: NativeDialogProps) {
  const { theme } = useAppTheme();

  return (
    <Modal onRequestClose={onDismiss} transparent visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            theme.shadows.elevated,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            {actions.map((action) => (
              <Pressable
                accessibilityRole="button"
                disabled={action.disabled}
                key={action.id}
                onPress={() => {
                  action.onPress();
                  onDismiss();
                }}
                style={({ pressed }) => [
                  styles.action,
                  {
                    backgroundColor: pressed
                      ? theme.colors.backgroundSecondary
                      : theme.colors.surface,
                    borderRadius: theme.radius.pill,
                    opacity: action.disabled ? theme.opacities.disabled : 1,
                    padding: theme.spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.headline,
                    { color: action.destructive ? theme.colors.danger : theme.colors.textPrimary },
                  ]}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { maxWidth: 420, width: '100%' },
  actions: { marginTop: 20 },
  action: { alignItems: 'center' },
});
