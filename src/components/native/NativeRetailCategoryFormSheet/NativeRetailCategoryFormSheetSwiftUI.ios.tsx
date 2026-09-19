import {
  BottomSheet,
  Button,
  Group,
  HStack,
  Host,
  Picker,
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
  foregroundColor,
  frame,
  padding,
  presentationBackground,
  presentationBackgroundInteraction as setPresentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { RETAIL_FINANCE_GROUP_OPTIONS } from '@/types/data';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCategoryFormSheetProps,
  NativeRetailCategoryFormValues,
} from './NativeRetailCategoryFormSheet.types';
import { roundedFont } from '../nativeTypography';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

export default function NativeRetailCategoryFormSheetSwiftUI({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailCategoryFormSheetProps) {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailCategoryFormValues>({
    financeGroup: 'other',
    label: '',
  });
  const [financeGroupIndex, setFinanceGroupIndex] = useState(3);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const labelState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      const financeGroup = initialValues?.financeGroup ?? 'other';
      setValues({ financeGroup, label: initialValues?.label ?? '' });
      setFinanceGroupIndex(
        Math.max(
          0,
          RETAIL_FINANCE_GROUP_OPTIONS.findIndex((option) => option.value === financeGroup),
        ),
      );
      setError(undefined);
    }
  }, [initialValues?.financeGroup, initialValues?.label, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => labelState.set(values.label), [labelState, values.label]);

  const handleSubmit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.label.trim()) {
      setError('Informe o nome da categoria.');
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

  const resolvedTitle = title ?? (mode === 'edit' ? 'Editar categoria' : 'Nova categoria');
  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            setPresentationBackgroundInteraction('enabled'),
            presentationBackground('systemBackground'),
            presentationDetents(['medium', 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          <VStack
            alignment="leading"
            spacing={16}
            modifiers={[padding({ horizontal: 20, top: 12, bottom: 28 })]}
          >
            <Text modifiers={[roundedFont({ size: 22, weight: 'bold' })]}>{resolvedTitle}</Text>
            <VStack
              alignment="leading"
              spacing={8}
              modifiers={[
                background('secondarySystemGroupedBackground'),
                cornerRadius(20),
                padding({ horizontal: 16, vertical: 12 }),
              ]}
            >
              <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>Nome</Text>
              <TextField
                axis="horizontal"
                modifiers={[
                  roundedFont({ textStyle: 'body' }),
                  autocorrectionDisabled(false),
                  background('systemGray6'),
                  cornerRadius(12),
                  ...(testModeEnabled ? [disabledModifier(true)] : []),
                  padding({ horizontal: 12, vertical: 10 }),
                ]}
                onTextChange={(label) => setValues((current) => ({ ...current, label }))}
                placeholder="Ex.: Cestas"
                text={labelState as NativeTextState}
              />
              <Picker
                label="Grupo financeiro"
                onSelectionChange={(selection) => {
                  const index = Number(selection);
                  const financeGroup = RETAIL_FINANCE_GROUP_OPTIONS[index]?.value ?? 'other';
                  setFinanceGroupIndex(index);
                  setValues((current) => ({ ...current, financeGroup }));
                }}
                selection={financeGroupIndex}
                modifiers={[
                  pickerStyle('menu'),
                  ...(testModeEnabled ? [disabledModifier(true)] : []),
                ]}
              >
                {RETAIL_FINANCE_GROUP_OPTIONS.map((option, index) => (
                  <Text key={option.value} modifiers={[roundedFont({}), tag(index)]}>
                    {option.label}
                  </Text>
                ))}
              </Picker>
            </VStack>
            {error ? <Text modifiers={[foregroundColor('#FF3B30')]}>{error}</Text> : null}
            <HStack modifiers={[frame({ maxWidth: 1000 })]}>
              <Spacer />
              <Button
                label={mode === 'edit' ? 'Salvar' : 'Adicionar'}
                modifiers={[
                  buttonStyle('glassProminent'),
                  ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
                  accessibilityLabel(mode === 'edit' ? 'Salvar categoria' : 'Adicionar categoria'),
                ]}
                onPress={() => {
                  triggerNativeButtonHaptic('light');
                  void handleSubmit();
                }}
              />
            </HStack>
          </VStack>
        </Group>
      </BottomSheet>
    </Host>
  );
}
