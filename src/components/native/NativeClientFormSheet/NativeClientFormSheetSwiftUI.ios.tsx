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
  disabled,
  font,
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
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const nameState = useNativeState('');
  const addressState = useNativeState('');
  const bucketPriceState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setName('');
      setAddress('');
      setBucketPrice('');
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
    bucketPriceState.set(bucketPrice);
  }, [bucketPrice, bucketPriceState]);

  const handleSubmit = async () => {
    setError(undefined);
    setSubmitting(true);
    const values: NativeClientFormValues = { address, bucketPrice, name };
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
      <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{label}</Text>
      <TextField
        axis="horizontal"
        modifiers={[
          autocorrectionDisabled(inputKeyboardType === 'decimal-pad'),
          background('systemGray6'),
          cornerRadius(12),
          keyboardType(inputKeyboardType),
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
        <Text modifiers={[font({ size: 17, weight: 'bold' })]}>{title}</Text>
      </ZStack>

      {groupedForm}

      {error ? (
        <Text modifiers={[foregroundColor('#FF3B30'), font({ size: 14 })]}>{error}</Text>
      ) : null}

      <HStack modifiers={[frame({ maxWidth: 1000, alignment: 'trailing' })]}>
        <Spacer />
        <Button
          label="Adicionar"
          modifiers={[
            buttonStyle('glassProminent'),
            controlSize('large'),
            ...(submitting ? [disabled(true)] : []),
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
