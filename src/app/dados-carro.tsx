import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativeTextField } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useCarSettings } from '@/hooks/useCarSettings';
import { useAppTheme } from '@/theme';

export default function CarDataRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { settings, updateField } = useCarSettings();

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Dados"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Dados do Carro"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard style={[styles.card, { marginTop: theme.spacing.md }]}>
        <CarField
          label="Autonomia Gasolina"
          onChangeText={(value) => updateField('gasolineAutonomy', value)}
          value={settings.gasolineAutonomy}
        />
        <CarField
          label="Autonomia Álcool"
          onChangeText={(value) => updateField('alcoholAutonomy', value)}
          value={settings.alcoholAutonomy}
        />
      </GlassCard>
    </PremiumScreen>
  );
}

function CarField({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  content: { flexGrow: 1, gap: 16 },
  field: { gap: 8 },
});
