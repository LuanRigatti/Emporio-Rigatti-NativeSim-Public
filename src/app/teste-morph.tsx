import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  CrossScreenGlassMorphTarget,
  NativeGlassBackButton,
  useCrossScreenGlassMorph,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export default function TesteMorphScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { startTransition } = useCrossScreenGlassMorph();

  const handleOpenTeste1 = () => {
    triggerLightImpactHaptic();
    startTransition('test-cross-morph', () => {
      router.push('/teste-1');
    });
  };

  const morphOrigin = (
    <CrossScreenGlassMorphTarget
      color={theme.colors.textPrimary}
      height={44}
      morphId="test-cross-morph"
      shape="circle"
      symbols={['ellipsis']}
      width={44}
    />
  );

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      leftActions={<NativeGlassBackButton onPress={() => router.back()} />}
      mode="transparent"
      rightActions={morphOrigin}
      title="Teste Morph"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        {
          marginTop: theme.spacing.xxxl + theme.spacing.xl,
          paddingTop: theme.spacing.sm,
        },
      ]}
      overlayHeader={header}
      overlayHeaderUnderlay
      progressiveBlurHeight={
        theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
      }
      progressiveBlurTopOffset={0}
      progressiveBlur
    >
      <View style={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
        <PremiumCard
          style={{
            borderRadius: theme.radius.xl,
            padding: theme.spacing.sm,
          }}
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
                padding: theme.spacing.md,
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
                Tocar para iniciar o morph nativo SwiftUI (1 círculo 44×44 para 1 cápsula 100×44).
              </Text>
            </View>
          </Pressable>
        </PremiumCard>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
  },
  textContainer: {
    flex: 1,
  },
});
