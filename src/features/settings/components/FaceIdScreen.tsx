import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativeToggle } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useBiometricUnlockPreference } from '@/hooks/useBiometricUnlockPreference';
import { useAppTheme } from '@/theme';

export function FaceIdScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { enabled, isHydrated, updateEnabled } = useBiometricUnlockPreference();

  const handleToggle = useCallback(
    async (nextEnabled: boolean) => {
      try {
        const result = await updateEnabled(nextEnabled);
        if (result.success) return;

        Alert.alert(
          result.reason === 'unavailable' ? 'Face ID indisponível' : 'Face ID não ativado',
          result.reason === 'unavailable'
            ? 'Configure o Face ID no dispositivo antes de ativar esta opção.'
            : 'A autenticação foi cancelada ou não foi concluída.',
        );
      } catch {
        Alert.alert('Face ID não ativado', 'Não foi possível salvar esta preferência local.');
      }
    },
    [updateEnabled],
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Face ID"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard
        style={[
          styles.card,
          {
            borderRadius: theme.radius.xl + theme.spacing.sm,
            marginTop: theme.spacing.md,
          },
        ]}
      >
        <View style={styles.toggleRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Usar Face ID
          </Text>
          {isHydrated ? (
            <View style={styles.toggleControl}>
              <NativeToggle
                label=""
                onValueChange={(value) => void handleToggle(value)}
                value={enabled}
              />
            </View>
          ) : (
            <View style={styles.togglePlaceholder} />
          )}
        </View>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  card: { marginHorizontal: 0, paddingVertical: 8 },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  toggleControl: { alignItems: 'flex-end', minWidth: 52 },
  togglePlaceholder: { height: 32, width: 52 },
});
