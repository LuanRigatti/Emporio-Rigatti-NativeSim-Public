import { BlurView } from 'expo-blur';
import {
  BottomSheet,
  Button,
  DatePicker,
  Group,
  HStack,
  Host,
  Image,
  List,
  Menu,
  RNHostView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  background,
  buttonStyle,
  contentShape,
  contentTransition,
  controlSize,
  cornerRadius,
  disabled as disabledModifier,
  font,
  frame,
  foregroundStyle,
  glassEffect,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listStyle,
  layoutPriority,
  offset,
  padding,
  presentationBackgroundInteraction as setPresentationBackgroundInteraction,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  scrollContentBackground,
  scrollDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { PresentationDetent } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import {
  registrarSheetDetailDarkSurface,
  registrarSheetDetailLightSurface,
  spacing,
  useAppTheme,
} from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { NativeBottomSheetProps } from './NativeBottomSheet.types';
import { NATIVE_SHEET_PRESENTATION_BACKGROUND } from '../nativeSheetBackground';
import RegistrarDeliveryPagerRN from './RegistrarDeliveryPagerRN';
import NativeSheetFieldIcon from '../NativeSheetFieldIcon';
import { roundedFont } from '../nativeTypography';
import {
  createNativeDayItems,
  createNativeMonthItems,
  createNativeYearItems,
  formatNativeToolbarDate,
  updateNativeDate,
} from '../nativeDateToolbarUtils';

const NATIVE_SHEET_TRANSPARENT_BACKGROUND = '#00000000';
const REGISTRAR_LIST_COMPACT_DETENT = { fraction: 0.48 } as const;
const REGISTRAR_LIST_EXPANDED_DETENT = { fraction: 0.78 } as const;
const REGISTRAR_DETAIL_DETENT = { fraction: 0.48 } as const;

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  content,
  detents,
  onSelect,
  onDismiss,
  onVisibleChange,
  visible,
  onConfirm,
  onDetentChange,
  onPageSettled,
  selectedItem: controlledSelectedItem,
  title,
  initialQuantity,
  initialDetent,
  selectedDetent,
  glassSurface = false,
  glassTint,
  initialPage = 0,
  useClientPager = false,
  presentationBackgroundInteraction: backgroundInteraction = 'enabled',
  presentationBackgroundMode = 'system',
  hostSizing = 'content',
}: NativeBottomSheetProps) {
  const { width } = useWindowDimensions();
  const { resolvedMode, theme } = useAppTheme();
  const confirmButtonWidth = width * 0.84;
  const { enabled: testModeEnabled, currency: maskCurrency, number: maskNumber } =
    useTestModePresentation();
  const usesRegistrarSheetBehavior = content == null;
  const usesClientPager = usesRegistrarSheetBehavior && useClientPager;
  const usesInlineClientSelection =
    usesRegistrarSheetBehavior && !usesClientPager && initialPage === 1;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [quantityDirection, setQuantityDirection] = useState<'up' | 'down'>('up');
  const [currentDetent, setCurrentDetent] = useState<PresentationDetent>(
    initialDetent ??
      (usesInlineClientSelection ? REGISTRAR_DETAIL_DETENT : REGISTRAR_LIST_COMPACT_DETENT),
  );
  const [detailDetentSettled, setDetailDetentSettled] = useState(false);
  const selectedItem = controlledSelectedItem ?? null;
  const detailRowVerticalPadding = usesInlineClientSelection ? 6 : 8;
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth() + 1;
  const dateMenuMonths = createNativeMonthItems();
  const dateMenuYears = createNativeYearItems();
  const dateMenuDays = createNativeDayItems(selectedYear, selectedMonth);
  const effectiveBucketPrice = selectedItem?.bucketPrice ?? bucketPrice;
  const presentedQuantity = maskNumber(bucketQuantity);
  const presentedTotal = testModeEnabled
    ? maskCurrency(0)
    : new Intl.NumberFormat('pt-BR', {
        currency: 'BRL',
        style: 'currency',
      }).format(effectiveBucketPrice * bucketQuantity);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setBucketQuantity(1);
      setQuantityDirection('up');
      setSelectedDate(new Date());
      setCurrentDetent(
        usesInlineClientSelection ? REGISTRAR_DETAIL_DETENT : REGISTRAR_LIST_COMPACT_DETENT,
      );
    }
  }, [usesInlineClientSelection, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible && initialQuantity != null) {
      setBucketQuantity(Math.max(1, Math.round(initialQuantity)));
    }
  }, [initialQuantity, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedItem) setDetailDetentSettled(false);
  }, [selectedItem]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSelect = (item: (typeof items)[number]) => {
    onSelect?.(item);
  };

  const renderDetailSurface = () => (
    <RNHostView matchContents={false}>
      <View
        pointerEvents="none"
        style={[
          styles.detailSurface,
          {
            borderColor: theme.colors.separator,
            borderRadius: theme.radius.xl + spacing.sm,
          },
        ]}
      >
        {resolvedMode !== 'dark' ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lightDetailSurface]} />
        ) : null}
        {resolvedMode === 'dark' ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.darkDetailSurface]} />
        ) : null}
        {resolvedMode === 'dark' ? (
          <BlurView
            key={resolvedMode}
            intensity={70}
            style={StyleSheet.absoluteFill}
            tint="systemChromeMaterialDark"
          />
        ) : null}
      </View>
    </RNHostView>
  );

  const inlineClientMenu = (
    <Menu modifiers={[buttonStyle('plain')]} label={
      <HStack
        alignment="center"
        spacing={8}
        modifiers={[padding({ horizontal: 4 }), contentShape(shapes.rectangle())]}
      >
        <Text
          modifiers={[
            roundedFont({ size: 17, weight: 'semibold' }),
            ...(selectedItem ? [] : [foregroundStyle(theme.colors.textSecondary)]),
          ]}
        >
          {selectedItem?.title ?? 'Selecionar'}
        </Text>
        <Image color={theme.colors.textSecondary} size={14} systemName="chevron.right" />
      </HStack>
    }>
      {items.map((item) => (
        <Button
          key={item.id}
          label={item.title}
          modifiers={[roundedFont({})]}
          onPress={() => handleSelect(item)}
        />
      ))}
    </Menu>
  );

  const inlineDetailRows = (
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
        <NativeSheetFieldIcon systemImage="person.crop.circle" />
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
          <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Cliente</Text>
          <Text
            modifiers={[
              roundedFont({ size: 13, weight: 'regular' }),
              foregroundStyle(theme.colors.textSecondary),
            ]}
          >
            Selecionar cliente
          </Text>
        </VStack>
        <Spacer />
        {inlineClientMenu}
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
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              contentShape(shapes.circle()),
              accessibilityLabel('Diminuir quantidade'),
              disabledModifier(testModeEnabled),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              setQuantityDirection('down');
              setBucketQuantity((value) => Math.max(1, value - 1));
            }}
          >
            <ZStack
              modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.circle())]}
            >
              <Image size={17} systemName="minus" />
            </ZStack>
          </Button>
          <Text
            modifiers={[
              roundedFont({ size: 17, weight: 'semibold' }),
              contentTransition('numericText', {
                countsDown: quantityDirection === 'down',
              }),
              animation(Animation.easeInOut({ duration: 0.18 }), bucketQuantity),
            ]}
          >
            {presentedQuantity}
          </Text>
          <Button
            modifiers={[
              padding({ all: 0 }),
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 44, height: 44, alignment: 'center' }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              contentShape(shapes.circle()),
              accessibilityLabel('Aumentar quantidade'),
              disabledModifier(testModeEnabled),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              setQuantityDirection('up');
              setBucketQuantity((value) => value + 1);
            }}
          >
            <ZStack
              modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.circle())]}
            >
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
        <Text
          modifiers={[
            roundedFont({ size: 17, weight: 'semibold' }),
            padding({ trailing: spacing.sm }),
          ]}
        >
          {presentedTotal}
        </Text>
      </HStack>
    </VStack>
  );

  const clientPagerDateMenu = (
    <Menu
      modifiers={[buttonStyle('plain'), accessibilityLabel('Selecionar data')]}
      label={
        <HStack
          alignment="center"
          modifiers={[
            padding({ horizontal: 14, vertical: 8 }),
            frame({ width: 72, height: 44, alignment: 'center' }),
            glassEffect({
              glass: { interactive: true, variant: 'regular' },
              shape: 'capsule',
            }),
            contentShape(shapes.capsule()),
          ]}
        >
          <Text modifiers={[roundedFont({ size: 17 })]}>
            {formatNativeToolbarDate(selectedDate)}
          </Text>
        </HStack>
      }
    >
      <Menu label="Mês" systemImage="calendar">
        {dateMenuMonths.map((item) => (
          <Button
            key={String(item.value)}
            label={item.label}
            modifiers={[roundedFont({})]}
            onPress={() =>
              setSelectedDate((value) => updateNativeDate(value, { month: item.value }))
            }
          />
        ))}
      </Menu>
      <Menu label="Ano" systemImage="calendar.badge.clock">
        {dateMenuYears.map((item) => (
          <Button
            key={String(item.value)}
            label={item.label}
            modifiers={[roundedFont({})]}
            onPress={() =>
              setSelectedDate((value) => updateNativeDate(value, { year: item.value }))
            }
          />
        ))}
      </Menu>
      <Menu label="Dia" systemImage="calendar.day.timeline.left">
        {dateMenuDays.map((value) => (
          <Button
            key={String(value)}
            label={String(value)}
            modifiers={[roundedFont({})]}
            onPress={() => setSelectedDate((date) => updateNativeDate(date, { day: value }))}
          />
        ))}
      </Menu>
    </Menu>
  );

  const clientPagerDetailRows = (
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
        {clientPagerDateMenu}
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
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              contentShape(shapes.circle()),
              accessibilityLabel('Diminuir quantidade'),
              disabledModifier(testModeEnabled),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              setQuantityDirection('down');
              setBucketQuantity((value) => Math.max(1, value - 1));
            }}
          >
            <ZStack modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.circle())]}>
              <Image size={17} systemName="minus" />
            </ZStack>
          </Button>
          <Text
            modifiers={[
              roundedFont({ size: 17, weight: 'semibold' }),
              contentTransition('numericText', {
                countsDown: quantityDirection === 'down',
              }),
              animation(Animation.easeInOut({ duration: 0.18 }), bucketQuantity),
            ]}
          >
            {presentedQuantity}
          </Text>
          <Button
            modifiers={[
              padding({ all: 0 }),
              buttonStyle('plain'),
              controlSize('regular'),
              frame({ width: 44, height: 44, alignment: 'center' }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              contentShape(shapes.circle()),
              accessibilityLabel('Aumentar quantidade'),
              disabledModifier(testModeEnabled),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              setQuantityDirection('up');
              setBucketQuantity((value) => value + 1);
            }}
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
        <Text
          modifiers={[
            roundedFont({ size: 17, weight: 'semibold' }),
            padding({ trailing: spacing.sm }),
            offset({ x: -16 }),
          ]}
        >
          {presentedTotal}
        </Text>
      </HStack>
    </VStack>
  );

  const clientPagerDetailView = (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[padding({ horizontal: 16, top: 14, bottom: 16 }), frame({ maxWidth: 1000, maxHeight: Infinity, alignment: 'top' })]}
    >
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' }), offset({ y: 16 })]}
      >
        <ZStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'center' }), offset({ y: 8 })]}
        >
          <HStack
            alignment="center"
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: spacing.sm })]}
          >
            <Button
              modifiers={[
                buttonStyle('plain'),
                controlSize('regular'),
                frame({ width: 48, height: 48, alignment: 'center' }),
                contentShape(shapes.rectangle()),
                accessibilityLabel('Voltar para clientes'),
              ]}
              onPress={() => {
                triggerNativeButtonHaptic('light');
                onPageSettled?.(0);
              }}
            >
              <Image
                color={theme.colors.textSecondary}
                modifiers={[font({ size: 18, weight: 'semibold' })]}
                systemName="chevron.left"
              />
            </Button>
          </HStack>
          <Text modifiers={[roundedFont({ size: 18, weight: 'semibold' })]}>
            {selectedItem?.title ?? title}
          </Text>
        </ZStack>
        {clientPagerDetailRows}
      </VStack>
      <ZStack
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, alignment: 'center' }), padding({ horizontal: spacing.xs, vertical: spacing.sm })]}
      >
        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}
        >
          <Button
            modifiers={[
              buttonStyle('plain'),
              controlSize('large'),
              ...(testModeEnabled ? [disabledModifier(true)] : []),
            ]}
            onPress={() => {
              if (!selectedItem || testModeEnabled) return;

              onConfirm?.({
                bucketPrice: effectiveBucketPrice,
                client: selectedItem,
                date: selectedDate,
                quantity: bucketQuantity,
              });
              onVisibleChange(false);
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
              Confirmar
            </Text>
          </Button>
        </HStack>
      </ZStack>
    </VStack>
  );

  const detailView = (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        padding({ horizontal: 16, top: 14, bottom: 16 }),
        frame({ maxWidth: 1000, maxHeight: Infinity, alignment: 'top' }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={spacing.xs}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          ...(usesInlineClientSelection ? [offset({ y: 20 })] : []),
        ]}
      >
        {selectedItem || usesInlineClientSelection ? (
          <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
            <HStack
              alignment="center"
              modifiers={[frame({ maxWidth: 1000, alignment: 'center' }), padding({ trailing: 8 })]}
            >
              {usesInlineClientSelection ? (
                <Menu
                  modifiers={[buttonStyle('plain'), accessibilityLabel('Selecionar data')]}
                  label={
                    <HStack
                      alignment="center"
                      modifiers={[
                        padding({ horizontal: 14, vertical: 8 }),
                        frame({ width: 72, height: 44, alignment: 'center' }),
                        glassEffect({
                          glass: { interactive: true, variant: 'regular' },
                          shape: 'capsule',
                        }),
                        contentShape(shapes.capsule()),
                      ]}
                    >
                      <Text modifiers={[roundedFont({ size: 17 })]}>
                        {formatNativeToolbarDate(selectedDate)}
                      </Text>
                    </HStack>
                  }
                >
                  <Menu label="Mês" systemImage="calendar">
                    {dateMenuMonths.map((item) => (
                      <Button
                        key={String(item.value)}
                        label={item.label}
                        modifiers={[roundedFont({})]}
                        onPress={() =>
                          setSelectedDate((value) => updateNativeDate(value, { month: item.value }))
                        }
                      />
                    ))}
                  </Menu>
                  <Menu label="Ano" systemImage="calendar.badge.clock">
                    {dateMenuYears.map((item) => (
                      <Button
                        key={String(item.value)}
                        label={item.label}
                        modifiers={[roundedFont({})]}
                        onPress={() =>
                          setSelectedDate((value) => updateNativeDate(value, { year: item.value }))
                        }
                      />
                    ))}
                  </Menu>
                  <Menu label="Dia" systemImage="calendar.day.timeline.left">
                    {dateMenuDays.map((value) => (
                      <Button
                        key={String(value)}
                        label={String(value)}
                        modifiers={[roundedFont({})]}
                        onPress={() =>
                          setSelectedDate((date) => updateNativeDate(date, { day: value }))
                        }
                      />
                    ))}
                  </Menu>
                </Menu>
              ) : null}
              <Spacer />
              <Button
                modifiers={[
                  buttonStyle('plain'),
                  controlSize('regular'),
                  frame({ width: 48, height: 48 }),
                  glassEffect({
                    glass: { interactive: true, variant: 'regular' },
                    shape: 'circle',
                  }),
                  offset({ x: 4, y: usesInlineClientSelection ? 0 : -9 }),
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
            <Text modifiers={[roundedFont({ size: 18, weight: 'semibold' })]}>
              {selectedItem?.title ?? title}
            </Text>
          </ZStack>
        ) : null}
        {usesInlineClientSelection ? (
          inlineDetailRows
        ) : (
          <ZStack
            alignment="topLeading"
            modifiers={[
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              padding({ horizontal: 0, vertical: 0 }),
              offset({ y: 4 }),
            ]}
          >
            {renderDetailSurface()}
            <VStack
              alignment="leading"
              spacing={spacing.xs}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
              <VStack
                alignment="leading"
                spacing={spacing.xs}
                modifiers={[
                  padding({
                    leading: spacing.lg,
                    trailing: spacing.md,
                    top: spacing.xs,
                    bottom: spacing.md,
                  }),
                ]}
              >
              {usesInlineClientSelection ? (
                <HStack
                  alignment="center"
                  spacing={8}
                  modifiers={[
                    padding({ vertical: detailRowVerticalPadding }),
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                  ]}
                  >
                  <Image size={18} systemName="person.crop.circle" />
                  <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Cliente</Text>
                  <Spacer />
                  <Menu
                    modifiers={[buttonStyle('plain')]}
                    label={
                      <HStack
                        alignment="center"
                        spacing={8}
                        modifiers={[
                          padding({ horizontal: 4 }),
                          contentShape(shapes.rectangle()),
                        ]}
                      >
                        <Text
                          modifiers={[
                            roundedFont({ size: 17, weight: 'semibold' }),
                            ...(selectedItem ? [] : [foregroundStyle(theme.colors.textSecondary)]),
                          ]}
                        >
                          {selectedItem?.title ?? 'Selecionar'}
                        </Text>
                        <Image
                          color={theme.colors.textSecondary}
                          size={14}
                          systemName="chevron.right"
                        />
                      </HStack>
                    }
                  >
                    {items.map((item) => (
                      <Button
                        key={item.id}
                        label={item.title}
                        modifiers={[roundedFont({})]}
                        onPress={() => handleSelect(item)}
                      />
                    ))}
                  </Menu>
                </HStack>
              ) : null}
              {!usesInlineClientSelection ? (
                <HStack
                  alignment="center"
                  spacing={8}
                  modifiers={[padding({ vertical: detailRowVerticalPadding })]}
                >
                  <Image size={18} systemName="calendar" />
                  <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Data</Text>
                  <Spacer />
                  <DatePicker
                    displayedComponents={['date']}
                    modifiers={[roundedFont({})]}
                    onDateChange={setSelectedDate}
                    selection={selectedDate}
                  />
                </HStack>
              ) : null}
              <HStack
                alignment="center"
                spacing={8}
                modifiers={[
                  padding({ vertical: detailRowVerticalPadding }),
                  offset({ y: usesInlineClientSelection ? 0 : 6 }),
                ]}
              >
                <Image
                  modifiers={usesInlineClientSelection ? [offset({ y: -2 })] : []}
                  size={18}
                  systemName="shippingbox"
                />
                <Text
                  modifiers={[roundedFont({ size: 17, weight: 'semibold' }), offset({ y: -2 })]}
                >
                  Baldes
                </Text>
                <Spacer />
                <Button
                  modifiers={[
                    buttonStyle('plain'),
                    controlSize('regular'),
                    glassEffect({
                      glass: { interactive: true, variant: 'regular' },
                      shape: 'circle',
                    }),
                    accessibilityLabel('Diminuir quantidade'),
                    disabledModifier(!selectedItem || testModeEnabled),
                ]}
                onPress={() => {
                  triggerNativeButtonHaptic('light');
                  setQuantityDirection('down');
                  setBucketQuantity((value) => Math.max(1, value - 1));
                  }}
                >
                  <ZStack
                    modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.rectangle())]}
                  >
                    <Image size={17} systemName="minus" />
                  </ZStack>
                </Button>
                <Text
                  modifiers={[
                    roundedFont({ size: 17, weight: 'semibold' }),
                    contentTransition('numericText', {
                      countsDown: quantityDirection === 'down',
                    }),
                    animation(Animation.easeInOut({ duration: 0.18 }), bucketQuantity),
                  ]}
                >
                  {presentedQuantity}
                </Text>
                <Button
                  modifiers={[
                    buttonStyle('plain'),
                    controlSize('regular'),
                    glassEffect({
                      glass: { interactive: true, variant: 'regular' },
                      shape: 'circle',
                    }),
                    accessibilityLabel('Aumentar quantidade'),
                    disabledModifier(!selectedItem || testModeEnabled),
                ]}
                onPress={() => {
                  triggerNativeButtonHaptic('light');
                  setQuantityDirection('up');
                  setBucketQuantity((value) => value + 1);
                  }}
                >
                  <ZStack
                    modifiers={[frame({ width: 44, height: 44 }), contentShape(shapes.rectangle())]}
                  >
                    <Image size={17} systemName="plus" />
                  </ZStack>
                </Button>
              </HStack>
              <HStack
                alignment="center"
                spacing={8}
                modifiers={[
                  padding({ vertical: detailRowVerticalPadding }),
                  offset({ y: usesInlineClientSelection ? 0 : 10 }),
                ]}
              >
                <Image modifiers={[offset({ x: 4 })]} size={16} systemName="dollarsign" />
                <Text
                  modifiers={[roundedFont({ size: 17, weight: 'semibold' }), offset({ x: 8 })]}
                >
                  Valor total
                </Text>
                <Spacer />
                <Text
                  modifiers={[
                    roundedFont({ size: 17, weight: 'semibold' }),
                    padding({ trailing: 16 }),
                  ]}
                >
                  {presentedTotal}
                </Text>
              </HStack>
              </VStack>
            </VStack>
          </ZStack>
        )}
      </VStack>
      <ZStack
        alignment="center"
        modifiers={[
            frame({ maxWidth: Infinity, alignment: 'center' }),
            padding({ horizontal: spacing.xs, vertical: spacing.sm }),
            offset({ y: usesInlineClientSelection ? 8 : 0 }),
        ]}
      >
        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}
        >
          <Button
            modifiers={[
              buttonStyle('plain'),
              controlSize('large'),
              ...(usesInlineClientSelection
                ? []
                : [disabledModifier(!selectedItem || testModeEnabled)]),
            ]}
            onPress={() => {
              if (!selectedItem || testModeEnabled) return;

              onConfirm?.({
                bucketPrice: effectiveBucketPrice,
                client: selectedItem,
                date: selectedDate,
                quantity: bucketQuantity,
              });
              onVisibleChange(false);
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
              Confirmar
            </Text>
          </Button>
        </HStack>
      </ZStack>
    </VStack>
  );

  const listView = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ top: 1 }),
      ]}
    >
      <List
        modifiers={[
          listStyle('plain'),
          scrollDisabled(false),
          scrollContentBackground('hidden'),
          padding({ horizontal: 0, bottom: 0 }),
        ]}
      >
        {items.map((item) => (
          <Button
            key={item.id}
            modifiers={[
              buttonStyle('plain'),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              listRowBackground('clear'),
              listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
              listRowSeparator('hidden'),
              accessibilityLabel(item.title),
            ]}
            onPress={() => handleSelect(item)}
          >
            <HStack
              alignment="center"
              spacing={0}
              modifiers={[
                padding({
                  leading: spacing.xxl,
                  trailing: spacing.xl,
                  vertical: spacing.lg,
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                contentShape(shapes.rectangle()),
              ]}
            >
              <Text modifiers={[roundedFont({ size: 18, weight: 'medium' })]}>
                {item.title}
              </Text>
              <Spacer />
              <Image
                color={theme.colors.textSecondary}
                modifiers={[font({ size: theme.sizes.iconSmall - 4, weight: 'semibold' })]}
                systemName="chevron.right"
              />
            </HStack>
          </Button>
        ))}
      </List>
    </VStack>
  );

  const clientPagerListView = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ top: 1 }),
      ]}
    >
      <List
        modifiers={[
          listStyle('plain'),
          scrollDisabled(false),
          scrollContentBackground('hidden'),
          padding({ horizontal: 0, bottom: 0 }),
        ]}
      >
        {items.map((item) => (
          <Button
            key={item.id}
            modifiers={[
              buttonStyle('plain'),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              listRowBackground('clear'),
              listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
              listRowSeparator('hidden'),
              accessibilityLabel(item.title),
            ]}
            onPress={() => handleSelect(item)}
          >
            <HStack
              alignment="center"
              spacing={12}
              modifiers={[
                padding({ leading: spacing.lg, trailing: spacing.xl, vertical: spacing.sm }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                contentShape(shapes.rectangle()),
              ]}
            >
              <NativeSheetFieldIcon
                systemImage={(item.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
              />
              <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1)]}>
                <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>
                  {item.title}
                </Text>
                <Text
                  modifiers={[
                    roundedFont({ size: 13, weight: 'regular' }),
                    foregroundStyle(theme.colors.textSecondary),
                  ]}
                >
                  {item.subtitle ?? 'Cliente'}
                </Text>
              </VStack>
              <Spacer />
              <Image
                color={theme.colors.textSecondary}
                modifiers={[font({ size: 18, weight: 'semibold' })]}
                systemName="chevron.right"
              />
            </HStack>
          </Button>
        ))}
      </List>
    </VStack>
  );

  const registroSheetContentBody = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ horizontal: 0, top: 12, bottom: 0 }),
      ]}
    >
      <RNHostView matchContents={false}>
        {usesInlineClientSelection ? (
          <Host
            pointerEvents="box-none"
            style={{ backgroundColor: 'transparent', flex: 1, width: '100%' }}
          >
            {detailView}
          </Host>
        ) : (
          <RegistrarDeliveryPagerRN
            detailPage={usesClientPager ? clientPagerDetailView : detailView}
            listPage={usesClientPager ? clientPagerListView : listView}
            onPageSettled={(page) => onPageSettled?.(page)}
            requestedPage={selectedItem ? 1 : initialPage}
          />
        )}
      </RNHostView>
    </VStack>
  );

  const wrapWithGlassSurface = (surfaceContent: ReactNode) => (
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
      {surfaceContent}
    </ZStack>
  );

  const registroSheetContent = glassSurface
    ? wrapWithGlassSurface(registroSheetContentBody)
    : registroSheetContentBody;

  const sheetContent = content
    ? glassSurface
      ? wrapWithGlassSurface(content)
      : content
    : registroSheetContent;
  const presentationBackgroundModifier =
    glassSurface || presentationBackgroundMode !== 'native'
      ? presentationBackground(
          glassSurface || presentationBackgroundMode === 'transparent'
            ? NATIVE_SHEET_TRANSPARENT_BACKGROUND
            : NATIVE_SHEET_PRESENTATION_BACKGROUND,
        )
      : null;
  const isListExpanded =
    usesRegistrarSheetBehavior &&
    typeof currentDetent === 'object' &&
    'fraction' in currentDetent &&
    currentDetent.fraction === REGISTRAR_LIST_EXPANDED_DETENT.fraction;
  const detailTransitionNeedsExpandedDetent =
    usesRegistrarSheetBehavior && selectedItem && isListExpanded && !detailDetentSettled;
  const sheetDetents =
    detents ??
    (usesRegistrarSheetBehavior
      ? selectedItem || usesInlineClientSelection
        ? detailTransitionNeedsExpandedDetent
          ? ([REGISTRAR_LIST_COMPACT_DETENT, REGISTRAR_LIST_EXPANDED_DETENT] as const)
          : ([REGISTRAR_DETAIL_DETENT] as const)
        : ([REGISTRAR_LIST_COMPACT_DETENT, REGISTRAR_LIST_EXPANDED_DETENT] as const)
      : initialDetent
        ? ([initialDetent, 'large'] as const)
        : ([{ fraction: 0.48 }, 'large'] as const));

  const selectedSheetDetent = usesRegistrarSheetBehavior
    ? selectedItem || usesInlineClientSelection
      ? REGISTRAR_DETAIL_DETENT
      : isListExpanded
        ? REGISTRAR_LIST_EXPANDED_DETENT
        : REGISTRAR_LIST_COMPACT_DETENT
    : undefined;
  const presentationSelection = selectedDetent ?? selectedSheetDetent ?? initialDetent;

  const handleIsPresentedChange = (nextVisible: boolean) => {
    onVisibleChange(nextVisible);
  };

  const handleDetentChange = (detent: PresentationDetent) => {
    if (usesRegistrarSheetBehavior) {
      setCurrentDetent(detent);

      if (
        selectedItem &&
        typeof detent === 'object' &&
        'fraction' in detent &&
        detent.fraction === REGISTRAR_DETAIL_DETENT.fraction
      ) {
        setDetailDetentSettled(true);
      }
    }

    if (
      detent === 'medium' ||
      detent === 'large' ||
      (typeof detent === 'object' && 'fraction' in detent)
    ) {
      onDetentChange?.(detent);
    }
  };

  return (
    <Host
      colorScheme={resolvedMode}
      matchContents={hostSizing === 'content' ? { horizontal: true } : false}
      pointerEvents="none"
      style={{ position: 'absolute', width }}
      useViewportSizeMeasurement={hostSizing === 'viewport'}
    >
      <BottomSheet
        isPresented={visible}
        onDismiss={() => {
          onDismiss?.();
        }}
        onIsPresentedChange={handleIsPresentedChange}
      >
        <Group
          modifiers={[
            setPresentationBackgroundInteraction(backgroundInteraction),
            ...(presentationBackgroundModifier ? [presentationBackgroundModifier] : []),
            presentationDetents(
              [...sheetDetents],
              usesRegistrarSheetBehavior || initialDetent || selectedDetent || onDetentChange
                ? {
                    ...(presentationSelection
                      ? { selection: presentationSelection }
                      : initialDetent
                        ? { selection: initialDetent }
                        : {}),
                    ...(usesRegistrarSheetBehavior || selectedDetent || onDetentChange
                      ? { onSelectionChange: handleDetentChange }
                      : {}),
                  }
                : undefined,
            ),
            presentationDragIndicator('visible'),
          ]}
        >
          {sheetContent}
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  detailSurface: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  lightDetailSurface: {
    backgroundColor: registrarSheetDetailLightSurface,
  },
  darkDetailSurface: {
    backgroundColor: registrarSheetDetailDarkSurface,
  },
});
