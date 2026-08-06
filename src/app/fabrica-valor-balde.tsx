import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativeTextField } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useFactorySettings } from '@/hooks/useFactorySettings';
import { useAppTheme } from '@/theme';

export default function FactoryBucketValueRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { settings, updateField } = useFactorySettings();

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Fábrica"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Valor do balde"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard style={[styles.card, { marginTop: theme.spacing.md }]}>
        <View style={styles.field}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Valor do balde
          </Text>
          <NativeTextField
            accessibilityLabel="Valor do balde"
            keyboardType="decimal-pad"
            onChangeText={(value) => updateField('bucketCost', value)}
            placeholder="R$ 0,00"
            value={settings.bucketCost}
          />
        </View>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  field: { gap: 8 },
});
