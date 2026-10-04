import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { NativeTextField, NativeToggle } from '@/components/native';
import type { NativeClientFormValues } from '@/components/native';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { submitClientCreation } from '@/features/clients/submitClientCreation';
import { RetailOrderPrimaryButton } from '@/features/retail-orders/components/RetailOrderPrimaryButton';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { useClients } from '@/hooks/useClients';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

const EMPTY_FORM: NativeClientFormValues = {
  address: '',
  bucketPrice: '',
  name: '',
  usesBoleto: false,
  usesInvoice: false,
};

export default function NewClientRoute() {
  const router = useRouter();
  const { saveCustomClient } = useClients(undefined, { loadOnMount: false });
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const [values, setValues] = useState(EMPTY_FORM);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Novo cliente"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );

  const updateField = <K extends keyof NativeClientFormValues>(
    key: K,
    value: NativeClientFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError(undefined);
  };

  const handleSubmit = useCallback(async () => {
    if (testModeEnabled || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(undefined);
    Keyboard.dismiss();

    try {
      await submitClientCreation(values, saveCustomClient, testModeEnabled);
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Não foi possível salvar o cliente.',
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [router, saveCustomClient, testModeEnabled, values]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Novo cliente"
        contentGap={0}
        contentTopInset={contentTopInset}
        largeTitle={largeTitle}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollContentContainerStyle={{
          paddingBottom:
            theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl + stickyActionFooterHeight,
          paddingHorizontal: 0,
        }}
      >
        <View
          style={[
            styles.content,
            {
              gap: theme.spacing.md,
              paddingHorizontal: theme.layout.screenHorizontalPadding,
              paddingTop: theme.spacing.md,
            },
          ]}
        >
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.footnote, { color: theme.colors.danger }]}
            >
              {error}
            </Text>
          ) : null}

          <PremiumCard
            style={[
              {
                backgroundColor: cardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                gap: theme.spacing.md,
              },
            ]}
          >
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Cliente
            </Text>
            <NativeTextField
              accessibilityLabel="Nome"
              disabled={testModeEnabled || isSubmitting}
              label="Nome"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Nome do cliente"
              value={values.name}
            />
            <NativeTextField
              accessibilityLabel="Endereço"
              disabled={testModeEnabled || isSubmitting}
              label="Endereço"
              onChangeText={(value) => updateField('address', value)}
              placeholder="Endereço completo"
              value={values.address}
            />
          </PremiumCard>

          <PremiumCard
            style={[
              {
                backgroundColor: cardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                gap: theme.spacing.md,
              },
            ]}
          >
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Comercial
            </Text>
            <NativeTextField
              accessibilityLabel="Valor do balde"
              disabled={testModeEnabled || isSubmitting}
              keyboardType="decimal-pad"
              label="Valor do balde"
              onChangeText={(value) => updateField('bucketPrice', value)}
              placeholder="R$ 0,00"
              value={values.bucketPrice}
            />
          </PremiumCard>

          <PremiumCard
            style={[
              {
                backgroundColor: cardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Documentos
            </Text>
            <NativeToggle
              disabled={testModeEnabled || isSubmitting}
              label="Usa nota fiscal"
              onValueChange={(value) => updateField('usesInvoice', value)}
              value={values.usesInvoice}
            />
            <NativeToggle
              disabled={testModeEnabled || isSubmitting}
              label="Usa boleto"
              onValueChange={(value) => updateField('usesBoleto', value)}
              value={values.usesBoleto}
            />
          </PremiumCard>
        </View>
      </ProgressiveCollapsibleScreen>
      <StickyActionFooter height={stickyActionFooterHeight}>
        <RetailOrderPrimaryButton
          accessibilityLabel="Adicionar cliente"
          disabled={testModeEnabled || isSubmitting}
          label="Adicionar"
          onPress={handleSubmit}
          preserveDisabledAppearance
        />
      </StickyActionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
  screen: { flex: 1 },
});
