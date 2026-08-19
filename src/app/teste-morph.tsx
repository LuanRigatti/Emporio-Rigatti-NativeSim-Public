import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  CrossScreenGlassMorphTarget,
  NativeGlassBackButton,
  NativeGlassMorphActionGroup,
  useCrossScreenGlassMorph,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export default function TesteMorphScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { setMorphState } = useCrossScreenGlassMorph();

  useEffect(() => {
    setMorphState('circle');
    return () => {
      setMorphState(null);
    };
  }, [setMorphState]);

  useFocusEffect(
    useCallback(() => {
      setMorphState('circle');
    }, [setMorphState]),
  );

  const handleOpenTeste1 = () => {
    triggerLightImpactHaptic();
    setMorphState('capsule');
    router.push('/teste-1');
  };

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => {
            setMorphState(null);
            router.back();
          }}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      rightActions={<CrossScreenGlassMorphTarget shape="circle" width={90} />}
      title="Teste Morph"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      {/* Teste 1: Morph Cross-Screen (1 círculo ⇄ 1 cápsula) */}
      <GlassCard
        style={[
          styles.card,
          {
            borderRadius: theme.radius.xl + theme.spacing.sm,
          },
        ]}
      >
        <Pressable
          accessible
          accessibilityRole="button"
          onPress={handleOpenTeste1}
          style={({ pressed }) => [
            styles.row,
            {
              borderRadius: theme.radius.lg,
              opacity: pressed ? theme.opacities.pressed : 1,
              padding: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.textContainer}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Teste 1
            </Text>
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginTop: 2 },
              ]}
            >
              Morph cross-screen: 1 círculo (44×44) ⇄ 1 cápsula (100×44).
            </Text>
          </View>
        </Pressable>
      </GlassCard>

      {/* Teste 2: Morph Local (1 círculo ⇄ 2 botões) */}
      <GlassCard
        style={[
          styles.card,
          {
            alignItems: 'center',
            borderRadius: theme.radius.xl + theme.spacing.sm,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 68,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.textContainer}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Liquid Glass Morph
          </Text>
          <Text
            style={[theme.typography.footnote, { color: theme.colors.textSecondary, marginTop: 2 }]}
          >
            Morph local: 1 círculo ⇄ 2 botões.
          </Text>
        </View>
        <NativeGlassMorphActionGroup color={theme.colors.textPrimary} />
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 12 },
  content: { flexGrow: 1, gap: 16 },
  row: {
    flexDirection: 'row',
  },
  textContainer: {
    flex: 1,
  },
});
