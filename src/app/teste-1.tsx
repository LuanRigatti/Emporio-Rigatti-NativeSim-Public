import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  CrossScreenGlassMorphTarget,
  NativeGlassBackButton,
  useCrossScreenGlassMorph,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export default function Teste1Screen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { setMorphState } = useCrossScreenGlassMorph();

  useEffect(() => {
    setMorphState('capsule');
  }, [setMorphState]);

  useFocusEffect(
    useCallback(() => {
      setMorphState('capsule');
    }, [setMorphState]),
  );

  const handleBack = () => {
    triggerLightImpactHaptic();
    setMorphState('circle');
    router.back();
  };

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
      rightActions={<CrossScreenGlassMorphTarget shape="capsule" width={90} />}
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
