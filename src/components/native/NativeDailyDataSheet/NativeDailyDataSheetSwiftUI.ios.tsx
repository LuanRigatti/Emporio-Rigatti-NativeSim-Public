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
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { triggerNativeButtonHaptic } from '@/utils/haptics';

import type {
  NativeDailyDataSheetProps,
  NativeDailyDataValues,
} from './NativeDailyDataSheet.types';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

const EMPTY_VALUES: NativeDailyDataValues = { estar: '', other: '' };

export default function NativeDailyDataSheetSwiftUI({
  initialValues = EMPTY_VALUES,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeDailyDataSheetProps) {
  const [values, setValues] = useState<NativeDailyDataValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const estarState = useNativeState(initialValues.estar);
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

  const field = (label: string, text: NativeTextState, fieldName: keyof NativeDailyDataValues) => (
    <HStack alignment="center" spacing={12} modifiers={[padding({ vertical: 10 })]}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{label}</Text>
      <Spacer />
      <TextField
        axis="horizontal"
        modifiers={[
          autocorrectionDisabled(true),
          background('systemGray6'),
          cornerRadius(12),
          frame({ width: 132, height: 42 }),
          keyboardType('decimal-pad'),
          padding({ horizontal: 10 }),
        ]}
        onTextChange={(value) => update(fieldName, value)}
        placeholder="R$ 0,00"
        text={text}
      />
    </HStack>
  );

  const content = (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        background('systemBackground'),
        frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }),
        padding({ horizontal: 20, top: 12, bottom: 22 }),
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
            onPress={() => {
              triggerNativeButtonHaptic('light');
              onVisibleChange(false);
            }}
          >
            <Image size={18} systemName="xmark" />
          </Button>
        </HStack>
        <Text modifiers={[font({ size: 17, weight: 'bold' })]}>Adicionar dados diários</Text>
      </ZStack>

      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          background('systemGray6'),
          cornerRadius(24),
          frame({ maxWidth: 1000, alignment: 'leading' }),
          padding({ horizontal: 16, vertical: 8 }),
        ]}
      >
        {field('Estar', estarState, 'estar')}
        <Divider />
        {field('Outros', otherState, 'other')}
      </VStack>

      <HStack modifiers={[frame({ maxWidth: 1000, alignment: 'trailing' })]}>
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
            presentationBackground('systemBackground'),
            presentationDetents([{ fraction: 0.4 }]),
            presentationDragIndicator('visible'),
          ]}
        >
          {content}
        </Group>
      </BottomSheet>
    </Host>
  );
}
