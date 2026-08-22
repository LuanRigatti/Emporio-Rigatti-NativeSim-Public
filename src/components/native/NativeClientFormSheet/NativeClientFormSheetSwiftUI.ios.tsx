import {
  BottomSheet,
  Button,
  Divider,
  Group,
  HStack,
  Host,
  Image,
  Spacer,
  Text,
  TextField,
  Toggle,
  VStack,
  ZStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  controlSize,
  cornerRadius,
  disabled as disabledModifier,
  disabled,
  foregroundColor,
  frame,
  glassEffect,
  keyboardType,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { roundedFont } from '../nativeTypography';

import type {
  NativeClientFormSheetProps,
  NativeClientFormValues,
} from './NativeClientFormSheet.types';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

export default function NativeClientFormSheetSwiftUI({
  onSubmit,
  onVisibleChange,
  title = 'Adicionar cliente',
  visible,
}: NativeClientFormSheetProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [bucketPrice, setBucketPrice] = useState('');
  const [usesInvoice, setUsesInvoice] = useState(false);
  const [usesBoleto, setUsesBoleto] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const { enabled: testModeEnabled, input: maskInput } = useTestModePresentation();
  const nameState = useNativeState('');
  const addressState = useNativeState('');
  const bucketPriceState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setName('');
      setAddress('');
      setBucketPrice('');
      setUsesInvoice(false);
      setUsesBoleto(false);
      setError(undefined);
      setSubmitting(false);
    }
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    nameState.set(name);
  }, [name, nameState]);

  useEffect(() => {
    addressState.set(address);
  }, [address, addressState]);

  useEffect(() => {
    bucketPriceState.set(maskInput(bucketPrice) ?? '');
  }, [bucketPrice, bucketPriceState, maskInput]);

  const handleSubmit = async () => {
    if (testModeEnabled) return;
    setError(undefined);
    setSubmitting(true);
    const values: NativeClientFormValues = {
      address,
      bucketPrice,
      name,
      usesBoleto,
      usesInvoice,
    };
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
      modifiers={[frame({ maxWidth: 1000 }), padding({ vertical: 12 })]}
    >
      <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>{label}</Text>
      <TextField
        axis="horizontal"
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(inputKeyboardType === 'decimal-pad'),
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
      {field('Nome', nameState, setName, 'Nome do cliente', 'default')}
      <Divider />
      {field('Endereço', addressState, setAddress, 'Endereço completo', 'default')}
      <Divider />
      {field('Valor do balde', bucketPriceState, setBucketPrice, 'R$ 0,00', 'decimal-pad')}
      <Divider />
      <HStack modifiers={[padding({ trailing: 8, vertical: 12 })]}>
        <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>
          Usa nota fiscal
        </Text>
        <Spacer />
        <Toggle
          isOn={usesInvoice}
          label=""
          modifiers={[controlSize('regular'), ...(testModeEnabled ? [disabledModifier(true)] : [])]}
          onIsOnChange={setUsesInvoice}
        />
      </HStack>
      <Divider />
      <HStack modifiers={[padding({ trailing: 8, vertical: 12 })]}>
        <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>Usa boleto</Text>
        <Spacer />
        <Toggle
          isOn={usesBoleto}
          label=""
          modifiers={[controlSize('regular'), ...(testModeEnabled ? [disabledModifier(true)] : [])]}
          onIsOnChange={setUsesBoleto}
        />
      </HStack>
    </VStack>
  );

  const content = (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        background('systemBackground'),
        frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }),
        padding({ horizontal: 20, top: 12, bottom: 28 }),
      ]}
    >
      <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
        <HStack modifiers={[frame({ maxWidth: 1000, alignment: 'trailing' })]}>
          <Button
            modifiers={[
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 44, height: 44 }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              accessibilityLabel('Fechar'),
            ]}
            onPress={() => onVisibleChange(false)}
          >
            <Image size={18} systemName="xmark" />
          </Button>
        </HStack>
        <Text modifiers={[roundedFont({ size: 17, weight: 'bold' })]}>{title}</Text>
      </ZStack>

      {groupedForm}

      {error ? (
        <Text modifiers={[foregroundColor('#FF3B30'), roundedFont({ size: 14 })]}>{error}</Text>
      ) : null}

      <HStack modifiers={[frame({ maxWidth: 1000, alignment: 'trailing' })]}>
        <Spacer />
        <Button
          label="Adicionar"
          modifiers={[
            roundedFont({}),
            buttonStyle('glassProminent'),
            controlSize('large'),
              ...(submitting || testModeEnabled ? [disabled(true)] : []),
          ]}
          onPress={() => {
            triggerNativeButtonHaptic('light');
            void handleSubmit();
          }}
        />
      </HStack>
    </VStack>
  );

  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            presentationBackground('systemBackground'),
            presentationDetents(['large']),
            presentationDragIndicator('visible'),
          ]}
        >
          {content}
        </Group>
      </BottomSheet>
    </Host>
  );
}
