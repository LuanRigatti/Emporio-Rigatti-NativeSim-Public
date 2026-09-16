import {
  Button,
  Divider,
  HStack,
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
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { NativeSheet } from '@/components/native/NativeSheet';
import { spacing, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCostItemFormSheetProps,
  NativeRetailCostItemFormValues,
} from './NativeRetailCostItemFormSheet.types';
import { roundedFont } from '../nativeTypography';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

const EMPTY_VALUES: NativeRetailCostItemFormValues = { name: '', supplier: '', unit: '' };

export default function NativeRetailCostItemFormSheetSwiftUI({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailCostItemFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailCostItemFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const nameState = useNativeState('');
  const unitState = useNativeState('');
  const supplierState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_VALUES, ...initialValues });
      setError(undefined);
      return;
    }
    setValues(EMPTY_VALUES);
    setError(undefined);
    setSubmitting(false);
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => nameState.set(values.name), [nameState, values.name]);
  useEffect(() => unitState.set(values.unit), [unitState, values.unit]);
  useEffect(() => supplierState.set(values.supplier), [supplierState, values.supplier]);

  const update = (key: keyof NativeRetailCostItemFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.name.trim()) {
      setError('Informe o nome do item de custo.');
      return;
    }
    if (!values.unit.trim()) {
      setError('Informe a unidade-base do item de custo.');
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
    disabled = false,
  ) => (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[frame({ maxWidth: 1000 }), padding({ vertical: 10 })]}
    >
      <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>{label}</Text>
      <TextField
        axis="horizontal"
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(false),
          background('systemGray6'),
          cornerRadius(12),
          ...(disabled || testModeEnabled ? [disabledModifier(true)] : []),
          padding({ horizontal: 12, vertical: 10 }),
        ]}
        onTextChange={onTextChange}
        placeholder={placeholder}
        text={text}
      />
    </VStack>
  );

  const resolvedTitle = title ?? (mode === 'edit' ? 'Editar item de custo' : 'Novo item de custo');
  return (
    <NativeSheet
      detents={[{ fraction: 0.7 }, 'large']}
      onVisibleChange={onVisibleChange}
      presentationBackgroundInteraction="enabled"
      presentationBackgroundColor="systemBackground"
      visible={visible}
    >
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[padding({ horizontal: spacing.md, top: spacing.sm, bottom: spacing.lg })]}
      >
        <HStack modifiers={[frame({ maxWidth: 1000 })]}>
          <Text
            modifiers={[
              roundedFont({ size: 22, weight: 'bold' }),
              foregroundStyle(theme.colors.textPrimary),
            ]}
          >
            {resolvedTitle}
          </Text>
        </HStack>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            background('secondarySystemGroupedBackground'),
            cornerRadius(24),
            frame({ maxWidth: 1000, alignment: 'leading' }),
            padding({ horizontal: 16, vertical: 4 }),
          ]}
        >
          {field('Nome', nameState, (value) => update('name', value), 'Ex.: Café')}
          <Divider />
          {field(
            'Unidade-base',
            unitState,
            (value) => update('unit', value),
            'Ex.: unidade, kg, litro',
            mode === 'edit',
          )}
          <Divider />
          {field(
            'Fornecedor (opcional)',
            supplierState,
            (value) => update('supplier', value),
            'Opcional',
          )}
        </VStack>
        {error ? (
          <Text modifiers={[roundedFont({ size: 14 }), foregroundStyle('#FF3B30')]}>{error}</Text>
        ) : null}
        <HStack modifiers={[frame({ maxWidth: 1000 })]}>
          <Spacer />
          <Button
            label={mode === 'edit' ? 'Salvar' : 'Adicionar'}
            modifiers={[
              buttonStyle('glassProminent'),
              foregroundStyle(theme.colors.textPrimary),
              ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
              accessibilityLabel(
                mode === 'edit' ? 'Salvar item de custo' : 'Adicionar item de custo',
              ),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              void handleSubmit();
            }}
          />
        </HStack>
      </VStack>
    </NativeSheet>
  );
}
