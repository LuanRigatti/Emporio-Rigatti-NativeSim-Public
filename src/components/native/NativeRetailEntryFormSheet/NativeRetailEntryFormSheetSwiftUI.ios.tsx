import {
  Button,
  DatePicker,
  HStack,
  ScrollView,
  Spacer,
  Text,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  cornerRadius,
  disabled as disabledModifier,
  foregroundStyle,
  frame,
  keyboardType,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { NativeSheet } from '@/components/native/NativeSheet';
import { spacing, useAppTheme } from '@/theme';
import { normalizeMoney, parseIsoCalendarDate, todayIso } from '@/utils/data';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCostEntryFormSheetProps,
  NativeRetailCostEntryFormValues,
} from './NativeRetailEntryFormSheet.types';
import { roundedFont } from '../nativeTypography';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

const EMPTY_VALUES: NativeRetailCostEntryFormValues = {
  effectiveDate: todayIso(),
  purchaseTotalCost: '',
  purchasedQuantity: '',
  supplier: '',
};

export default function NativeRetailEntryFormSheetSwiftUI({
  initialValues,
  itemUnit,
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailCostEntryFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailCostEntryFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const purchasedQuantityState = useNativeState('');
  const purchaseTotalCostState = useNativeState('');
  const supplierState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_VALUES, effectiveDate: todayIso(), ...initialValues });
      setError(undefined);
      setSubmitting(false);
      return;
    }
    setValues(EMPTY_VALUES);
    setError(undefined);
    setSubmitting(false);
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(
    () => purchasedQuantityState.set(values.purchasedQuantity),
    [purchasedQuantityState, values.purchasedQuantity],
  );
  useEffect(
    () => purchaseTotalCostState.set(values.purchaseTotalCost),
    [purchaseTotalCostState, values.purchaseTotalCost],
  );
  useEffect(() => supplierState.set(values.supplier), [supplierState, values.supplier]);

  const update = (key: keyof NativeRetailCostEntryFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.purchasedQuantity.trim()) {
      setError('Informe a quantidade comprada.');
      return;
    }
    if (
      !values.purchaseTotalCost.trim() ||
      normalizeMoney(values.purchaseTotalCost) === undefined
    ) {
      setError('Informe o custo total da compra.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await onSubmit(values);
      onVisibleChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    text: NativeTextState,
    onTextChange: (value: string) => void,
    placeholder: string,
    inputKeyboardType: 'default' | 'decimal-pad',
  ) => (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[frame({ maxWidth: 1000 }), padding({ vertical: 10 })]}
    >
      <Text
        modifiers={[
          roundedFont({ size: 15, weight: 'semibold' }),
          foregroundStyle(theme.colors.textPrimary),
        ]}
      >
        {label}
      </Text>
      <TextField
        axis="horizontal"
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(inputKeyboardType === 'decimal-pad'),
          background('systemGray6'),
          cornerRadius(12),
          keyboardType(inputKeyboardType),
          ...(testModeEnabled || submitting ? [disabledModifier(true)] : []),
          padding({ horizontal: 12, vertical: 10 }),
        ]}
        onTextChange={onTextChange}
        placeholder={placeholder}
        text={text}
      />
    </VStack>
  );

  const dateValue = parseIsoCalendarDate(values.effectiveDate) ?? new Date();
  return (
    <NativeSheet
      detents={[{ fraction: 0.7 }, 'large']}
      onVisibleChange={onVisibleChange}
      presentationBackgroundInteraction="enabled"
      presentationBackgroundColor="systemBackground"
      visible={visible}
    >
      <ScrollView showsIndicators={false}>
        <VStack
          alignment="leading"
          spacing={16}
          modifiers={[
            frame({ maxWidth: 1000, alignment: 'topLeading' }),
            padding({ horizontal: spacing.md, top: spacing.sm, bottom: spacing.lg }),
          ]}
        >
          <Text
            modifiers={[
              roundedFont({ size: 22, weight: 'bold' }),
              foregroundStyle(theme.colors.textPrimary),
            ]}
          >
            {title ?? 'Nova entrada de custo'}
          </Text>
          <HStack modifiers={[frame({ maxWidth: 1000 })]}>
            <Text modifiers={[foregroundStyle(theme.colors.textPrimary)]}>Data efetiva</Text>
            <Spacer />
            <DatePicker
              displayedComponents={['date']}
              onDateChange={(date) => update('effectiveDate', todayIso(date))}
              selection={dateValue}
              title="Data efetiva"
            />
          </HStack>
          <Text
            modifiers={[
              roundedFont({ textStyle: 'footnote' }),
              foregroundStyle(theme.colors.textSecondary),
            ]}
          >
            Unidade: {itemUnit}
          </Text>
          {field(
            `Quantidade comprada (${itemUnit})`,
            purchasedQuantityState,
            (value) => update('purchasedQuantity', value),
            'Ex.: 10',
            'decimal-pad',
          )}
          {field(
            'Custo total da compra',
            purchaseTotalCostState,
            (value) => update('purchaseTotalCost', value),
            'R$ 0,00',
            'decimal-pad',
          )}
          {field(
            'Fornecedor (opcional)',
            supplierState,
            (value) => update('supplier', value),
            'Opcional',
            'default',
          )}
          {error ? (
            <Text modifiers={[roundedFont({ size: 14 }), foregroundStyle(theme.colors.danger)]}>
              {error}
            </Text>
          ) : null}
          <HStack modifiers={[frame({ maxWidth: 1000 })]}>
            <Spacer />
            <Button
              label="Adicionar entrada"
              modifiers={[
                buttonStyle('glassProminent'),
                ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
                accessibilityLabel('Adicionar entrada de custo'),
              ]}
              onPress={() => {
                triggerNativeButtonHaptic('light');
                void handleSubmit();
              }}
            />
          </HStack>
        </VStack>
      </ScrollView>
    </NativeSheet>
  );
}
