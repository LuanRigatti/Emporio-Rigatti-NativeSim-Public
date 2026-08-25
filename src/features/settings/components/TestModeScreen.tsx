import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeToggle } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useTestMode } from '@/hooks/useTestMode';
import { useAppTheme } from '@/theme';

export function TestModeScreen() {
  const { theme } = useAppTheme();
  const { enabled, isReady, setEnabled } = useTestMode();

  const header = <NativeGlassHeader mode="transparent" title="Modo Teste" />;

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
            Modo Teste
          </Text>
          {isReady ? (
            <View style={styles.toggleControl}>
              <NativeToggle label="" onValueChange={setEnabled} value={enabled} />
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
