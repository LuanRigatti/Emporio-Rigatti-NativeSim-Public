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
  cornerRadius,
  controlSize,
  frame,
  font,
  glassEffect,
  keyboardType,
  layoutPriority,
  offset,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { NATIVE_SHEET_PRESENTATION_BACKGROUND } from '@/components/native/nativeSheetBackground';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import type {
  NativeDailyDataSheetProps,
  NativeDailyDataValues,
} from './NativeDailyDataSheet.types';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

const EMPTY_VALUES: NativeDailyDataValues = {
  estar: '',
  fuelPrice: '',
  kilometers: '',
  other: '',
};

export default function NativeDailyDataSheetSwiftUI({
  initialValues = EMPTY_VALUES,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeDailyDataSheetProps) {
  const [values, setValues] = useState<NativeDailyDataValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const estarState = useNativeState(initialValues.estar);
  const fuelPriceState = useNativeState(initialValues.fuelPrice);
  const kilometersState = useNativeState(initialValues.kilometers);
  const otherState = useNativeState(initialValues.other);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) setValues(initialValues);
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    estarState.set(values.estar);
  }, [estarState, values.estar]);

  useEffect(() => {
    otherState.set(values.other);
  }, [otherState, values.other]);

  useEffect(() => {
    fuelPriceState.set(values.fuelPrice);
  }, [fuelPriceState, values.fuelPrice]);

  useEffect(() => {
    kilometersState.set(values.kilometers);
  }, [kilometersState, values.kilometers]);

  const update = (field: keyof NativeDailyDataValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onVisibleChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    text: NativeTextState,
    fieldName: keyof NativeDailyDataValues,
    currency = false,
  ) => (
    <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 4 })]}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), layoutPriority(1)]}>{label}</Text>
      <Spacer />
      <HStack
        modifiers={[
          background('systemGray6'),
          cornerRadius(12),
          frame({ width: 132, height: 42 }),
          padding({ horizontal: 10 }),
          offset({ x: 4 }),
        ]}
      >
        {currency ? <Text>R$</Text> : null}
        <TextField
          axis="horizontal"
          modifiers={[
            autocorrectionDisabled(true),
            frame({ maxWidth: 1000 }),
            keyboardType('decimal-pad'),
          ]}
          onTextChange={(value) => update(fieldName, value)}
          placeholder={currency ? '0,00' : '0,0'}
          text={text}
        />
      </HStack>
    </HStack>
  );

  const content = (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }),
        padding({ horizontal: 12, top: 14, bottom: 8 }),
        offset({ y: 8 }),
      ]}
    >
      <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
        <HStack
          modifiers={[frame({ maxWidth: 1000, alignment: 'trailing' }), padding({ trailing: 8 })]}
        >
          <Button
            modifiers={[
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 48, height: 48 }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              accessibilityLabel('Fechar'),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              onVisibleChange(false);
            }}
          >
            <Image size={20} systemName="xmark" />
          </Button>
        </HStack>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), offset({ y: -8 })]}>
          {'Dados Di\u00e1rios'}
        </Text>
      </ZStack>

      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[padding({ leading: 32, trailing: 0, vertical: 4 }), offset({ x: 16 })]}
      >
        {field('Estar', estarState, 'estar', true)}
        <Divider />
        {field('Outros', otherState, 'other', true)}
        <Divider />
        {field('Km', kilometersState, 'kilometers')}
        <Divider />
        {field('Combust\u00edvel', fuelPriceState, 'fuelPrice', true)}
      </VStack>

      <HStack
        modifiers={[
          frame({ maxWidth: 1000, alignment: 'trailing' }),
          padding({ top: 12, trailing: 8 }),
        ]}
      >
        <Spacer />
        <Button
          label="Adicionar"
          modifiers={[buttonStyle('glassProminent'), controlSize('large')]}
          onPress={() => {
            if (submitting) return;
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
            presentationBackground(NATIVE_SHEET_PRESENTATION_BACKGROUND),
            presentationDetents([{ fraction: 0.45 }]),
            presentationDragIndicator('visible'),
          ]}
        >
          {content}
        </Group>
      </BottomSheet>
    </Host>
  );
}
