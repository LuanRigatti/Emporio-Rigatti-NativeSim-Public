import {
  Button,
  Divider,
  HStack,
  Spacer,
  Text,
  TextField,
  Toggle,
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
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { NativeSheet } from '@/components/native/NativeSheet';
import { spacing, useAppTheme } from '@/theme';
import { normalizeMoney } from '@/utils/data';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import {
  EMPTY_RETAIL_CLIENT_FORM_VALUES,
  type NativeRetailClientFormSheetProps,
  type NativeRetailClientFormValues,
} from './NativeRetailClientFormSheet.types';
import { roundedFont } from '../nativeTypography';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

export default function NativeRetailClientFormSheetSwiftUI({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailClientFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailClientFormValues>(
    EMPTY_RETAIL_CLIENT_FORM_VALUES,
  );
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const nameState = useNativeState('');
  const phoneState = useNativeState('');
  const addressState = useNativeState('');
  const sourceState = useNativeState('');
  const referredByState = useNativeState('');
  const deliveryFeeState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_RETAIL_CLIENT_FORM_VALUES, ...initialValues });
      setError(undefined);
      return;
    }
    setValues(EMPTY_RETAIL_CLIENT_FORM_VALUES);
    setError(undefined);
    setSubmitting(false);
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => nameState.set(values.name), [nameState, values.name]);
  useEffect(() => phoneState.set(values.phone), [phoneState, values.phone]);
  useEffect(() => addressState.set(values.address), [addressState, values.address]);
  useEffect(() => sourceState.set(values.sourceType), [sourceState, values.sourceType]);
  useEffect(
    () => referredByState.set(values.referredByName),
    [referredByState, values.referredByName],
  );
  useEffect(
    () => deliveryFeeState.set(values.defaultDeliveryFee),
    [deliveryFeeState, values.defaultDeliveryFee],
  );

  const update = (key: keyof NativeRetailClientFormValues, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (
      values.defaultDeliveryFee.trim() &&
      normalizeMoney(values.defaultDeliveryFee) === undefined
    ) {
      setError('Informe uma taxa de entrega válida.');
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
    inputKeyboardType: 'default' | 'decimal-pad' | 'phone-pad',
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
          autocorrectionDisabled(inputKeyboardType !== 'default'),
          background('systemGray6'),
          cornerRadius(12),
          keyboardType(inputKeyboardType),
          ...(testModeEnabled ? [disabledModifier(true)] : []),
          padding({ horizontal: 12, vertical: 10 }),
        ]}
        onTextChange={onTextChange}
        placeholder={placeholder}
        text={text}
      />
    </VStack>
  );

  const groupedForm = (
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
      {field('Nome', nameState, (value) => update('name', value), 'Nome do cliente', 'default')}
      <Divider />
      {field(
        'Telefone',
        phoneState,
        (value) => update('phone', value),
        'Telefone (opcional)',
        'phone-pad',
      )}
      <Divider />
      {field(
        'Endereço',
        addressState,
        (value) => update('address', value),
        'Endereço (opcional)',
        'default',
      )}
      <Divider />
      <HStack modifiers={[padding({ trailing: 8, vertical: 12 })]}>
        <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>Possui indicação</Text>
        <Spacer />
        <Toggle
          isOn={values.hasReferral}
          label=""
          modifiers={testModeEnabled ? [disabledModifier(true)] : undefined}
          onIsOnChange={(value) => update('hasReferral', value)}
        />
      </HStack>
      {values.hasReferral ? (
        <>
          <Divider />
          {field(
            'Tipo/origem da indicação',
            sourceState,
            (value) => update('sourceType', value),
            'Ex.: Instagram, amigo',
            'default',
          )}
          <Divider />
          {field(
            'Quem indicou',
            referredByState,
            (value) => update('referredByName', value),
            'Nome (opcional)',
            'default',
          )}
        </>
      ) : null}
      <Divider />
      {field(
        'Taxa padrão de entrega',
        deliveryFeeState,
        (value) => update('defaultDeliveryFee', value),
        'R$ 0,00 (opcional)',
        'decimal-pad',
      )}
    </VStack>
  );

  const resolvedTitle = title ?? (mode === 'edit' ? 'Editar cliente' : 'Adicionar cliente');
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
        {groupedForm}
        {error ? (
          <Text modifiers={[roundedFont({ size: 14 }), foregroundStyle('#FF3B30')]}>{error}</Text>
        ) : null}
        <HStack modifiers={[frame({ maxWidth: 1000 })]}>
          <Spacer />
          <Button
            label={mode === 'edit' ? 'Salvar' : 'Adicionar'}
            modifiers={[
              buttonStyle('glassProminent'),
              tint(theme.colors.contrastSurface),
              foregroundStyle(theme.colors.contrastContent),
              ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
              accessibilityLabel(mode === 'edit' ? 'Salvar cliente' : 'Adicionar cliente'),
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
