import {
  BottomSheet,
  Button,
  Circle,
  Group,
  HStack,
  Host,
  Image,
  RNHostView,
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
  contentShape,
  cornerRadius,
  controlSize,
  disabled as disabledModifier,
  frame,
  font,
  foregroundStyle,
  glassEffect,
  keyboardType,
  layoutPriority,
  offset,
  padding,
  presentationBackgroundInteraction as setPresentationBackgroundInteraction,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { getLiquidGlassTint, spacing, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import {
  NATIVE_SHEET_PRESENTATION_BACKGROUND,
} from '@/components/native/nativeSheetBackground';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import RegistrarDeliveryPagerRN from '../NativeBottomSheet/RegistrarDeliveryPagerRN';
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

type DailyDataFieldName = keyof NativeDailyDataValues;

const DAILY_DATA_FIELDS = [
  {
    currency: true,
    description: 'Custo de estacionamento',
    fieldName: 'estar',
    label: 'Estar',
    systemImage: 'briefcase' as SFSymbol,
  },
  {
    currency: true,
    description: 'Outros custos do dia',
    fieldName: 'other',
    label: 'Outros',
    systemImage: 'ellipsis.circle' as SFSymbol,
  },
  {
    currency: false,
    description: 'Quilometragem do dia',
    fieldName: 'kilometers',
    label: 'Km',
    systemImage: 'speedometer' as SFSymbol,
  },
  {
    currency: true,
    description: 'Preço por litro',
    fieldName: 'fuelPrice',
    label: 'Combustível',
    systemImage: 'fuelpump' as SFSymbol,
  },
] as const;

export default function NativeDailyDataSheetSwiftUI({
  glassSurface = false,
  glassTint,
  initialValues = EMPTY_VALUES,
  onSubmit,
  onVisibleChange,
  presentationBackgroundMode = 'system',
  visible,
}: NativeDailyDataSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const confirmButtonWidth = width * 0.84;
  const dailyDataIconSurface = resolvedMode === 'dark' ? '#2C2C2E' : '#F2F2F7';
  const { enabled: testModeEnabled, input: maskInput } = useTestModePresentation();
  const [values, setValues] = useState<NativeDailyDataValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const estarState = useNativeState(initialValues.estar);
  const fuelPriceState = useNativeState(initialValues.fuelPrice);
  const kilometersState = useNativeState(initialValues.kilometers);
  const otherState = useNativeState(initialValues.other);
  const [selectedFieldName, setSelectedFieldName] = useState<DailyDataFieldName | null>(null);

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

  const handlePageSettled = (page: 0 | 1) => {
    if (page === 0) setSelectedFieldName(null);
  };

  const handleSheetVisibleChange = (nextVisible: boolean) => {
    if (!nextVisible) setSelectedFieldName(null);
    onVisibleChange(nextVisible);
  };

  const handleSubmit = async () => {
    if (testModeEnabled) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
      handleSheetVisibleChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    description: string,
    systemImage: SFSymbol,
    text: NativeTextState,
    fieldName: keyof NativeDailyDataValues,
    currency = false,
  ) => (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: spacing.sm })]}
    >
      <HStack
        alignment="center"
        spacing={12}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <HStack alignment="center" spacing={12} modifiers={[padding({ leading: spacing.sm })]}>
          {renderIcon(systemImage)}
          <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
            <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>{label}</Text>
            <Text
              modifiers={[
                roundedFont({ size: 13, weight: 'regular' }),
                foregroundStyle(theme.colors.textSecondary),
              ]}
            >
              {description}
            </Text>
          </VStack>
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
    </VStack>
  );

  function renderIcon(systemImage: SFSymbol) {
    return (
      <ZStack alignment="center" modifiers={[frame({ width: 54, height: 54 })]}>
        <Circle
          modifiers={[frame({ width: 54, height: 54 }), foregroundStyle(dailyDataIconSurface)]}
        />
        <Image color={theme.colors.textPrimary} size={21} systemName={systemImage} />
      </ZStack>
    );
  }

  const fieldStates: Record<DailyDataFieldName, NativeTextState> = {
    estar: estarState,
    fuelPrice: fuelPriceState,
    kilometers: kilometersState,
    other: otherState,
  };

  const listPage = (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' }), offset({ y: 12 })]}
    >
      {DAILY_DATA_FIELDS.map((item) => (
        <Button
          key={item.fieldName}
          modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' })]}
          onPress={() => {
            triggerNativeButtonHaptic('light');
            setSelectedFieldName(item.fieldName);
          }}
        >
          <HStack
            alignment="center"
            spacing={12}
            modifiers={[
              padding({ leading: spacing.sm }),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              padding({ vertical: spacing.sm }),
              contentShape(shapes.rectangle()),
            ]}
          >
            {renderIcon(item.systemImage)}
            <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
              <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>
                {item.label}
              </Text>
              <Text
                modifiers={[
                  roundedFont({ size: 13, weight: 'regular' }),
                  foregroundStyle(theme.colors.textSecondary),
                ]}
              >
                {item.description}
              </Text>
            </VStack>
            <Spacer />
            <Image
              color={theme.colors.textSecondary}
              modifiers={[
                font({ size: 18, weight: 'semibold' }),
                padding({ trailing: spacing.lg }),
                ...(item.fieldName === 'estar' ? [offset({ x: 2 })] : []),
              ]}
              systemName="chevron.right"
            />
          </HStack>
        </Button>
      ))}
    </VStack>
  );

  const selectedField = selectedFieldName
    ? DAILY_DATA_FIELDS.find((item) => item.fieldName === selectedFieldName)
    : null;
  const detailField = selectedField ?? DAILY_DATA_FIELDS[0];

  const addButton = (
    <ZStack
      alignment="center"
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'center' }),
        padding({ horizontal: spacing.xs, vertical: spacing.xs }),
      ]}
    >
      <HStack alignment="center" modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
        <Button
          modifiers={[
            buttonStyle('plain'),
            controlSize('large'),
            offset({ y: 76 }),
            ...(!selectedField || submitting || testModeEnabled
              ? [disabledModifier(true)]
              : []),
          ]}
          onPress={() => {
            if (!selectedField || submitting) return;
            triggerNativeButtonHaptic('light');
            void handleSubmit();
          }}
        >
          <Text
            modifiers={[
              roundedFont({ size: 17, weight: 'semibold' }),
              foregroundStyle(theme.colors.contrastContent),
              padding({ horizontal: 28, vertical: 14 }),
              frame({ width: confirmButtonWidth, height: 58, alignment: 'center' }),
              background(theme.colors.contrastSurface),
              cornerRadius(999),
              contentShape(shapes.capsule()),
            ]}
          >
            Adicionar
          </Text>
        </Button>
      </HStack>
    </ZStack>
  );

  const detailHeader = (
    <ZStack
      alignment="center"
      modifiers={[frame({ maxWidth: Infinity }), offset({ y: -64 })]}
    >
      <Text
        modifiers={[roundedFont({ size: 19, weight: 'semibold' }), offset({ y: 8 })]}
      >
        {detailField.label}
      </Text>
      <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Button
          modifiers={[
            padding({ all: 0 }),
            buttonStyle('plain'),
            controlSize('regular'),
            frame({ width: 44, height: 44 }),
            glassEffect({
              glass: {
                interactive: true,
                tint: getLiquidGlassTint(resolvedMode),
                variant: 'regular',
              },
              shape: 'circle',
            }),
            offset({ x: 8, y: 6 }),
            accessibilityLabel('Voltar'),
          ]}
          onPress={() => {
            triggerNativeButtonHaptic('light');
            setSelectedFieldName(null);
          }}
        >
          <Image
            color={theme.colors.textSecondary}
            modifiers={[font({ size: 18, weight: 'semibold' })]}
            systemName="chevron.left"
          />
        </Button>
        <Spacer />
      </HStack>
    </ZStack>
  );

  const detailPage = (
    <VStack
      alignment="leading"
      spacing={spacing.sm}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' }), padding({ horizontal: 2 })]}
    >
      {detailHeader}
      {field(
        detailField.label,
        detailField.description,
        detailField.systemImage,
        fieldStates[detailField.fieldName],
        detailField.fieldName,
        detailField.currency,
      )}
      {addButton}
    </VStack>
  );

  const pagerContent = (
    <RNHostView matchContents={false}>
      <RegistrarDeliveryPagerRN
        detailPage={detailPage}
        listPage={listPage}
        onPageSettled={handlePageSettled}
        requestedPage={selectedFieldName ? 1 : 0}
      />
    </RNHostView>
  );

  const content = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'topLeading' }),
        padding({ horizontal: 12, top: spacing.sm, bottom: spacing.xs }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={spacing.sm}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={4}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {pagerContent}
        </VStack>
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
            glass: {
              interactive: true,
              variant: 'regular',
              ...(glassTint ? { tint: glassTint } : {}),
            },
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
  const presentationBackgroundModifier =
    glassSurface || presentationBackgroundMode !== 'native'
      ? presentationBackground(
          glassSurface || presentationBackgroundMode === 'transparent'
            ? '#00000000'
            : NATIVE_SHEET_PRESENTATION_BACKGROUND,
        )
      : null;

  return (
    <Host
      colorScheme={resolvedMode}
      matchContents={false}
      pointerEvents="none"
      style={{ position: 'absolute', width }}
      useViewportSizeMeasurement
    >
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            setPresentationBackgroundInteraction('enabled'),
            ...(presentationBackgroundModifier ? [presentationBackgroundModifier] : []),
            presentationDetents([{ fraction: 0.46 }]),
            presentationDragIndicator('visible'),
          ]}
        >
          {sheetContent}
        </Group>
      </BottomSheet>
    </Host>
  );
}
