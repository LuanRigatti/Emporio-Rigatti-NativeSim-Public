import { StyleSheet, Text } from 'react-native';

import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

export default function Teste1Screen() {
  const { theme } = useAppTheme();

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: theme.sizes.touchTargetMinimum + theme.spacing.md,
        },
      ]}
      progressiveBlur
    >
      <GlassCard
        style={[
          styles.card,
          {
            borderRadius: theme.radius.xl + theme.spacing.sm,
            marginTop: theme.spacing.md,
          },
        ]}
      >
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          Destino do Liquid Glass morph em cápsula (100×44). Ao tocar no botão de voltar acima, o
          morph reverso nativo de cápsula para círculo é acionado.
        </Text>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16 },
  content: { flexGrow: 1, gap: 16 },
});
