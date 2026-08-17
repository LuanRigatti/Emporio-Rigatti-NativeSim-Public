import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  CrossScreenGlassMorphTarget,
  NativeGlassBackButton,
  useCrossScreenGlassMorph,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
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
      includeTopSafeArea
      leftActions={<NativeGlassBackButton onPress={handleBack} />}
      mode="transparent"
      rightActions={morphTarget}
      title="Teste 1"
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
            padding: theme.spacing.md,
          }}
        >
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Tela B — Teste 1
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            Destino do Liquid Glass morph (cápsula 100×44). Ao tocar no botão de voltar, o morph
            nativo reverso para o círculo (44×44) é acionado.
          </Text>
        </PremiumCard>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
