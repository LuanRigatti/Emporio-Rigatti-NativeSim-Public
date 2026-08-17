import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  CrossScreenGlassMorphTarget,
  NativeGlassBackButton,
  useCrossScreenGlassMorph,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

export default function Teste1Screen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { startBackTransition } = useCrossScreenGlassMorph();

  const handleBack = () => {
    startBackTransition('test-cross-morph', () => {
      router.back();
    });
  };

  const morphTarget = (
    <CrossScreenGlassMorphTarget
      color={theme.colors.textPrimary}
      height={44}
      morphId="test-cross-morph"
      shape="capsule"
      symbols={['ellipsis', 'xmark']}
      width={100}
    />
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Teste Morph"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={handleBack}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      rightActions={morphTarget}
      title="Teste 1"
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
