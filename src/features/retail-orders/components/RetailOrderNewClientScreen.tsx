import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import {
  NativeTextField,
  NativeToggle,
  type NativeRetailClientFormValues,
} from '@/components/native';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { retailClientFormToDraft } from '@/features/retail-clients/utils/retailClientForm';
import { useRetailClients } from '@/hooks/useRetailClients';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { EMPTY_RETAIL_CLIENT_FORM_VALUES } from '@/components/native/NativeRetailClientFormSheet/NativeRetailClientFormSheet.types';
import { normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { RetailOrderPrimaryButton } from './RetailOrderPrimaryButton';

export function RetailOrderNewClientScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { create } = useRetailClients({}, { loadOnMount: false });
  const [values, setValues] = useState<NativeRetailClientFormValues>(
    EMPTY_RETAIL_CLIENT_FORM_VALUES,
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const title = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Novo cliente"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const cardStyle = [
    styles.card,
    {
      backgroundColor: cardSurface,
      borderRadius: theme.radius.xl + theme.spacing.sm,
      gap: theme.spacing.md,
    },
  ];

  const update = (key: keyof NativeRetailClientFormValues, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (saving || testModeEnabled) return;
    const feeText = values.defaultDeliveryFee.trim();
    const fee = feeText ? normalizeMoney(feeText) : undefined;
    if (!values.name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (feeText && (fee === undefined || fee < 0)) {
      setError('A taxa padrão de entrega deve ser zero ou maior.');
      return;
    }

    setError(undefined);
    setSaving(true);
    Keyboard.dismiss();
    try {
      await create(retailClientFormToDraft(values));
      router.back();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Não foi possível salvar o cliente.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Novo cliente"
        contentGap={0}
        contentTopInset={contentTopInset}
        largeTitle={title}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
        scrollContentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xl + stickyActionFooterHeight,
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
          <PremiumCard style={cardStyle}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Cliente
            </Text>
            <NativeTextField
              accessibilityLabel="Nome"
              disabled={saving || testModeEnabled}
              label="Nome"
              onChangeText={(value) => update('name', value)}
              placeholder="Nome do cliente"
              value={values.name}
            />
            <NativeTextField
              accessibilityLabel="Telefone"
              disabled={saving || testModeEnabled}
              keyboardType="phone-pad"
              label="Telefone"
              onChangeText={(value) => update('phone', value)}
              placeholder="Telefone (opcional)"
              value={values.phone}
            />
            <NativeTextField
              accessibilityLabel="Endereço"
              disabled={saving || testModeEnabled}
              label="Endereço"
              multiline
              onChangeText={(value) => update('address', value)}
              placeholder="Endereço (opcional)"
              value={values.address}
            />
          </PremiumCard>

          <PremiumCard style={cardStyle}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Comercial
            </Text>
            <NativeTextField
              accessibilityLabel="Taxa padrão de entrega"
              disabled={saving || testModeEnabled}
              keyboardType="decimal-pad"
              label="Taxa padrão de entrega"
              onChangeText={(value) => update('defaultDeliveryFee', value)}
              placeholder="R$ 0,00 (opcional)"
              value={values.defaultDeliveryFee}
            />
          </PremiumCard>

          <PremiumCard style={cardStyle}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Indicação
            </Text>
            <NativeToggle
              disabled={saving || testModeEnabled}
              label="Possui indicação"
              onValueChange={(value) => update('hasReferral', value)}
              value={values.hasReferral}
            />
            {values.hasReferral ? (
              <>
                <NativeTextField
                  accessibilityLabel="Tipo ou origem da indicação"
                  disabled={saving || testModeEnabled}
                  label="Tipo/origem da indicação"
                  onChangeText={(value) => update('sourceType', value)}
                  placeholder="Ex.: Instagram, amigo"
                  value={values.sourceType}
                />
                <NativeTextField
                  accessibilityLabel="Quem indicou"
                  disabled={saving || testModeEnabled}
                  label="Quem indicou"
                  onChangeText={(value) => update('referredByName', value)}
                  placeholder="Nome (opcional)"
                  value={values.referredByName}
                />
              </>
            ) : null}
          </PremiumCard>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.footnote, { color: theme.colors.danger }]}
            >
              {error}
            </Text>
          ) : null}
        </View>
      </ProgressiveCollapsibleScreen>

      <StickyActionFooter height={stickyActionFooterHeight}>
        <RetailOrderPrimaryButton
          disabled={saving || testModeEnabled}
          label="Adicionar"
          onPress={() => void handleSubmit()}
        />
      </StickyActionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  content: { width: '100%' },
  screen: { flex: 1 },
});
