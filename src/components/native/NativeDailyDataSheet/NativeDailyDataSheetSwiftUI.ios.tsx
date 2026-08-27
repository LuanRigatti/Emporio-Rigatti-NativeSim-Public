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
  disabled as disabledModifier,
  frame,
  foregroundStyle,
  glassEffect,
  keyboardType,
  layoutPriority,
  offset,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { getLiquidGlassTint, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import {
  NATIVE_SHEET_PRESENTATION_BACKGROUND,
} from '@/components/native/nativeSheetBackground';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { roundedFont } from '../nativeTypography';

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
  glassSurface = false,
  initialValues = EMPTY_VALUES,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeDailyDataSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled, input: maskInput } = useTestModePresentation();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : '#F2EFEB';
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
    estarState.set(maskInput(values.estar) ?? '');
  }, [estarState, maskInput, values.estar]);

  useEffect(() => {
    otherState.set(maskInput(values.other) ?? '');
  }, [maskInput, otherState, values.other]);

  useEffect(() => {
    fuelPriceState.set(maskInput(values.fuelPrice) ?? '');
  }, [fuelPriceState, maskInput, values.fuelPrice]);

  useEffect(() => {
    kilometersState.set(maskInput(values.kilometers) ?? '');
  }, [kilometersState, maskInput, values.kilometers]);

  const update = (field: keyof NativeDailyDataValues, value: string) => {
    if (testModeEnabled) return;
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    if (testModeEnabled) return;
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
    systemImage: SFSymbol,
    text: NativeTextState,
    fieldName: keyof NativeDailyDataValues,
    currency = false,
  ) => (
    <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 4 })]}>
      <HStack spacing={6} modifiers={[layoutPriority(1)]}>
        <Image size={16} systemName={systemImage} />
        <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>{label}</Text>
      </HStack>
      <Spacer />
      <HStack
        modifiers={[
          background('systemGray6'),
          cornerRadius(12),
          frame({ width: 132, height: 42 }),
          padding({ horizontal: 10 }),
        ]}
      >
        <TextField
          axis="horizontal"
          modifiers={[
            roundedFont({ textStyle: 'body' }),
            autocorrectionDisabled(true),
            frame({ maxWidth: 1000 }),
            keyboardType('decimal-pad'),
            ...(testModeEnabled ? [disabledModifier(true)] : []),
            padding({ leading: 44 }),
          ]}
          onTextChange={(value) => update(fieldName, value)}
          placeholder={currency ? 'R$ 0,00' : 'Km 0,0'}
          text={text}
        />
      </HStack>
    </HStack>
  );

  const content = (
    <VStack
      alignment="leading"
      spacing={8}
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
        <Text modifiers={[roundedFont({ size: 17, weight: 'bold' }), offset({ y: 0 })]}>
          {'Dados Di\u00e1rios'}
        </Text>
      </ZStack>

      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ horizontal: 2 }),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            padding({ leading: 24, trailing: 0, vertical: 4 }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
            ),
            padding({ top: 4 }),
          ]}
        >
          {field('Estar', 'briefcase', estarState, 'estar', true)}
          <Divider />
          {field('Outros', 'ellipsis.circle', otherState, 'other', true)}
          <Divider />
          {field('Km', 'speedometer', kilometersState, 'kilometers')}
          <Divider />
          {field('Combust\u00edvel', 'fuelpump', fuelPriceState, 'fuelPrice', true)}
        </VStack>

        <HStack
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'trailing' }),
            padding({ top: 8, trailing: 8, bottom: 8 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <Spacer />
            <Button
              label="Adicionar"
            modifiers={[
              roundedFont({}),
              buttonStyle('glassProminent'),
              controlSize('large'),
              foregroundStyle(PlatformColor('label') as unknown as string),
              tint(getLiquidGlassTint(resolvedMode)),
              ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
            ]}
            onPress={() => {
              if (submitting) return;
              triggerNativeButtonHaptic('light');
              void handleSubmit();
            }}
          />
        </HStack>
      </VStack>
    </VStack>
  );

  const sheetContent = glassSurface ? (
    <ZStack
      alignment="topLeading"
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}
    >
      <ZStack
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            cornerRadius: theme.radius.card,
            shape: 'roundedRectangle',
          }),
        ]}
      >
        <Spacer />
      </ZStack>
      {content}
    </ZStack>
  ) : content;

  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            presentationBackground(
              glassSurface ? '#00000000' : NATIVE_SHEET_PRESENTATION_BACKGROUND,
            ),
            presentationDetents([{ fraction: 0.45 }]),
            presentationDragIndicator('visible'),
          ]}
        >
          {sheetContent}
        </Group>
      </BottomSheet>
    </Host>
  );
}
