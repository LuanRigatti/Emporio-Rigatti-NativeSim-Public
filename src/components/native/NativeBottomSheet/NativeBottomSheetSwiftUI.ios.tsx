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
import { roundedFont } from '../nativeTypography';

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
  initialQuantity,
  initialDetent,
  selectedDetent,
  glassSurface = false,
  glassTint,
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [quantityDirection, setQuantityDirection] = useState<'up' | 'down'>('up');
  const [currentDetent, setCurrentDetent] = useState<PresentationDetent>(
    initialDetent ?? REGISTRAR_LIST_COMPACT_DETENT,
  );
  const [detailDetentSettled, setDetailDetentSettled] = useState(false);
  const selectedItem = controlledSelectedItem ?? null;
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
      setCurrentDetent(REGISTRAR_LIST_COMPACT_DETENT);
    }
  }, [visible]);
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
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {selectedItem ? (
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
                  offset({ x: 4, y: -9 }),
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
              {selectedItem.title}
            </Text>
          </ZStack>
        ) : null}
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
            modifiers={[offset({ y: 0 }), frame({ maxWidth: Infinity })]}
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
              <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 8 })]}>
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
              <HStack
                alignment="center"
                spacing={8}
                modifiers={[padding({ vertical: 8 }), offset({ y: 6 })]}
              >
                <Image size={18} systemName="shippingbox" />
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
                modifiers={[padding({ vertical: 8 }), offset({ y: 10 })]}
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
      </VStack>
      <ZStack
        alignment="center"
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'center' }),
          padding({ horizontal: spacing.xs, vertical: spacing.sm }),
        ]}
      >
        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}
        >
          <Button
            label="Confirmar"
            modifiers={[
              roundedFont({ size: 17, weight: 'semibold' }),
              buttonStyle('plain'),
              controlSize('large'),
              foregroundStyle(theme.colors.contrastContent),
              padding({ horizontal: 28, vertical: 14 }),
              frame({ width: confirmButtonWidth, height: 58, alignment: 'center' }),
              background(theme.colors.contrastSurface),
              cornerRadius(999),
              disabledModifier(!selectedItem || testModeEnabled),
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
          />
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
        <RegistrarDeliveryPagerRN
          detailPage={detailView}
          listPage={listView}
          onPageSettled={(page) => onPageSettled?.(page)}
          requestedPage={selectedItem ? 1 : 0}
        />
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
      ? selectedItem
        ? detailTransitionNeedsExpandedDetent
          ? ([REGISTRAR_LIST_COMPACT_DETENT, REGISTRAR_LIST_EXPANDED_DETENT] as const)
          : ([REGISTRAR_DETAIL_DETENT] as const)
        : ([REGISTRAR_LIST_COMPACT_DETENT, REGISTRAR_LIST_EXPANDED_DETENT] as const)
      : initialDetent
        ? ([initialDetent, 'large'] as const)
        : ([{ fraction: 0.48 }, 'large'] as const));

  const selectedSheetDetent = usesRegistrarSheetBehavior
    ? selectedItem
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
