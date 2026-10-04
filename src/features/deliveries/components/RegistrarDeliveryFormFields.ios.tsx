import { Button, HStack, Host, Image, Menu, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  contentShape,
  contentTransition,
  controlSize,
  disabled,
  frame,
  foregroundStyle,
  glassEffect,
  layoutPriority,
  offset,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import NativeAnimatedNumber from '@/components/native/NativeAnimatedNumber/NativeAnimatedNumber';
import NativeSheetFieldIcon from '@/components/native/NativeSheetFieldIcon';
import { spacing, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  RegistrarDeliveryFormFieldsProps,
  RegistrarDeliveryQuantityDirection,
} from './RegistrarDeliveryFormFields.types';
import {
  createNativeDayItems,
  createNativeMonthItems,
  createNativeYearItems,
  formatNativeToolbarDate,
  updateNativeDate,
} from '@/components/native/nativeDateToolbarUtils';
import { roundedFont } from '@/components/native/nativeTypography';

export default function RegistrarDeliveryFormFields({
  date,
  onDateChange,
  onQuantityChange,
  quantity,
  quantityDirection,
  totalValue,
}: RegistrarDeliveryFormFieldsProps) {
  const { theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();
  const dateMenuButtonMinWidth = theme.sizes.touchTargetMinimum * 2 + spacing.xxs;
  const totalValueColumnWidth = theme.sizes.touchTargetMinimum * 2 + spacing.xs * 2 + spacing.sm;
  const selectedYear = date.getFullYear();
  const selectedMonth = date.getMonth() + 1;
  const dateMenuMonths = createNativeMonthItems();
  const dateMenuYears = createNativeYearItems();
  const dateMenuDays = createNativeDayItems(selectedYear, selectedMonth);
  const presentedTotal = testModeEnabled
    ? maskCurrency(0)
    : new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(totalValue);

  const dateMenu = (
    <Menu
      modifiers={[buttonStyle('plain'), accessibilityLabel('Selecionar data')]}
      label={
        <HStack
          alignment="center"
          modifiers={[
            padding({ horizontal: 14, vertical: 8 }),
            frame({ minWidth: dateMenuButtonMinWidth, height: 44, alignment: 'center' }),
            glassEffect({ glass: { interactive: true, variant: 'regular' }, shape: 'capsule' }),
            contentShape(shapes.capsule()),
          ]}
        >
          <Text modifiers={[roundedFont({ size: 17 })]}>{formatNativeToolbarDate(date)}</Text>
        </HStack>
      }
    >
      <Menu label="Mês" systemImage="calendar">
        {dateMenuMonths.map((item) => (
          <Button
            key={String(item.value)}
            label={item.label}
            modifiers={[roundedFont({})]}
            onPress={() => onDateChange(updateNativeDate(date, { month: item.value }))}
          />
        ))}
      </Menu>
      <Menu label="Ano" systemImage="calendar.badge.clock">
        {dateMenuYears.map((item) => (
          <Button
            key={String(item.value)}
            label={item.label}
            modifiers={[roundedFont({})]}
            onPress={() => onDateChange(updateNativeDate(date, { year: item.value }))}
          />
        ))}
      </Menu>
      <Menu label="Dia" systemImage="calendar.day.timeline.left">
        {dateMenuDays.map((value) => (
          <Button
            key={String(value)}
            label={String(value)}
            modifiers={[roundedFont({})]}
            onPress={() => onDateChange(updateNativeDate(date, { day: value }))}
          />
        ))}
      </Menu>
    </Menu>
  );

  const changeQuantity = (direction: RegistrarDeliveryQuantityDirection) => {
    triggerNativeButtonHaptic('light');
    onQuantityChange(direction === 'down' ? Math.max(1, quantity - 1) : quantity + 1, direction);
  };

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}
    >
      <HStack
        alignment="center"
        spacing={12}
        modifiers={[
          padding({ leading: spacing.sm }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ vertical: spacing.sm }),
        ]}
      >
        <NativeSheetFieldIcon systemImage="calendar" />
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
          <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Data</Text>
          <Text
            modifiers={[
              roundedFont({ size: 13, weight: 'regular' }),
              foregroundStyle(theme.colors.textSecondary),
            ]}
          >
            Data da entrega
          </Text>
        </VStack>
        <Spacer />
        {dateMenu}
        <Spacer modifiers={[frame({ width: spacing.sm + 4 })]} />
      </HStack>

      <HStack
        alignment="center"
        spacing={12}
        modifiers={[
          padding({ leading: spacing.sm }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ vertical: spacing.sm }),
        ]}
      >
        <NativeSheetFieldIcon systemImage="shippingbox" />
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
          <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Baldes</Text>
          <Text
            modifiers={[
              roundedFont({ size: 13, weight: 'regular' }),
              foregroundStyle(theme.colors.textSecondary),
            ]}
          >
            Quantidade da entrega
          </Text>
        </VStack>
        <Spacer />
        <HStack alignment="center" spacing={8} modifiers={[padding({ trailing: spacing.sm })]}>
          <Button
            modifiers={[
              padding({ all: 0 }),
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 44, height: 44, alignment: 'center' }),
              glassEffect({ glass: { interactive: true, variant: 'regular' }, shape: 'circle' }),
              contentShape(shapes.circle()),
              accessibilityLabel('Diminuir quantidade'),
              disabled(testModeEnabled),
            ]}
            onPress={() => changeQuantity('down')}
          >
            <ZStack modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.circle())]}>
              <Image size={17} systemName="minus" />
            </ZStack>
          </Button>
          <Text
            modifiers={[
              roundedFont({ size: 17, weight: 'semibold' }),
              contentTransition('numericText', { countsDown: quantityDirection === 'down' }),
              animation(Animation.easeInOut({ duration: 0.18 }), quantity),
            ]}
          >
            {maskNumber(quantity)}
          </Text>
          <Button
            modifiers={[
              padding({ all: 0 }),
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 44, height: 44, alignment: 'center' }),
              glassEffect({ glass: { interactive: true, variant: 'regular' }, shape: 'circle' }),
              contentShape(shapes.circle()),
              accessibilityLabel('Aumentar quantidade'),
              disabled(testModeEnabled),
            ]}
            onPress={() => changeQuantity('up')}
          >
            <ZStack modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.circle())]}>
              <Image size={17} systemName="plus" />
            </ZStack>
          </Button>
        </HStack>
      </HStack>

      <HStack
        alignment="center"
        spacing={12}
        modifiers={[
          padding({ leading: spacing.sm }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ vertical: spacing.sm }),
        ]}
      >
        <NativeSheetFieldIcon systemImage="dollarsign" />
        <HStack
          alignment="center"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
            <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Valor total</Text>
            <Text
              modifiers={[
                roundedFont({ size: 13, weight: 'regular' }),
                foregroundStyle(theme.colors.textSecondary),
              ]}
            >
              Total da entrega
            </Text>
          </VStack>
          <Spacer />
          <HStack
            alignment="center"
            modifiers={[
              frame({ width: totalValueColumnWidth, height: 22, alignment: 'trailing' }),
              padding({ trailing: spacing.sm }),
              offset({ x: spacing.md + spacing.xs }),
            ]}
          >
            <NativeAnimatedNumber
              alignment="trailing"
              animationEnabled
              color={theme.colors.textPrimary}
              fontSize={17}
              fontWeight="semibold"
              horizontalSizing="intrinsic"
              lineHeight={22}
              text={presentedTotal}
              value={testModeEnabled ? 0 : totalValue}
            />
          </HStack>
        </HStack>
      </HStack>
    </VStack>
  );
}

export function RegistrarDeliveryFormFieldsHost(props: RegistrarDeliveryFormFieldsProps) {
  const { resolvedMode } = useAppTheme();

  return (
    <Host colorScheme={resolvedMode} matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <RegistrarDeliveryFormFields {...props} />
    </Host>
  );
}
