import {
  BottomSheet,
  Button,
  DatePicker,
  Divider,
  Group,
  HStack,
  Host,
  Image,
  List,
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
  disabled as disabledModifier,
  frame,
  foregroundColor,
  hidden,
  glassEffect,
  listRowBackground,
  listStyle,
  offset,
  onTapGesture,
  padding,
  presentationDetents,
  presentationDragIndicator,
  scrollContentBackground,
  scrollDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { PresentationDetent } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/theme';

import { NativeInteractivePager, NativeInteractivePagerPage } from '../NativeInteractivePager';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';
import { roundedFont } from '../nativeTypography';

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  content,
  detents,
  onSelect,
  onPageSettled,
  onDismiss,
  onVisibleChange,
  title,
  visible,
  onConfirm,
  onDetentChange,
  selectedItem: controlledSelectedItem,
  initialQuantity,
  initialDetent,
  hostSizing = 'content',
}: NativeBottomSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [quantityDirection, setQuantityDirection] = useState<'up' | 'down'>('up');
  const [pageRequestID, setPageRequestID] = useState(0);
  const selectedItem = controlledSelectedItem ?? null;
  const effectiveBucketPrice = selectedItem?.bucketPrice ?? bucketPrice;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setBucketQuantity(1);
      setQuantityDirection('up');
      setSelectedDate(new Date());
      setPageRequestID(0);
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
    if (!visible) return;
    setPageRequestID((requestID) => requestID + 1);
  }, [controlledSelectedItem?.id, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSelect = (item: (typeof items)[number]) => {
    onSelect?.(item);
    if (selectedItem?.id === item.id) {
      setPageRequestID((requestID) => requestID + 1);
    }
  };

  const titleView = (
    <HStack
      alignment="center"
      spacing={6}
      modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
    >
      <Text modifiers={[roundedFont({ size: 15, weight: 'bold' }), offset({ y: -6 })]}>
        {title}
      </Text>
    </HStack>
  );

  const detailView = (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        padding({ horizontal: 16, top: 14, bottom: 16 }),
        frame({ maxWidth: 1000, alignment: 'top' }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          padding({ horizontal: 8, vertical: 8 }),
          background(
            cardBackground,
            shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
          ),
        ]}
      >
        {selectedItem ? (
          <VStack alignment="leading" spacing={12}>
            <HStack
              alignment="center"
              spacing={10}
              modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
            >
              <Text modifiers={[roundedFont({ size: 18, weight: 'semibold' })]}>
                {selectedItem.title}
              </Text>
            </HStack>
            <Divider />
          </VStack>
        ) : null}
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[padding({ horizontal: 12, top: 0, bottom: 4 })]}
        >
          <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 8 })]}>
            <Image size={18} systemName="calendar" />
            <Text modifiers={[roundedFont({ size: 16, weight: 'bold' })]}>Data</Text>
            <Spacer />
            <DatePicker
              displayedComponents={['date']}
              modifiers={[roundedFont({})]}
              onDateChange={setSelectedDate}
              selection={selectedDate}
            />
          </HStack>
          <Divider />
          <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 8 })]}>
            <Image size={18} systemName="shippingbox" />
            <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>Baldes</Text>
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
                disabledModifier(!selectedItem),
              ]}
              onPress={() => {
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
              {bucketQuantity}
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
                disabledModifier(!selectedItem),
              ]}
              onPress={() => {
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
          <Divider />
          <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 8 })]}>
            <Image size={16} systemName="brazilianrealsign" />
            <Text modifiers={[roundedFont({ size: 16, weight: 'bold' })]}>Valor total</Text>
            <Spacer />
            <Text
              modifiers={[roundedFont({ size: 17, weight: 'semibold' }), padding({ trailing: 16 })]}
            >
              {new Intl.NumberFormat('pt-BR', {
                currency: 'BRL',
                style: 'currency',
              }).format(effectiveBucketPrice * bucketQuantity)}
            </Text>
          </HStack>
        </VStack>
      </VStack>
      <HStack
        alignment="center"
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'trailing' }),
          padding({ top: 8, trailing: 12, bottom: 12 }),
          background(
            cardBackground,
            shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
          ),
        ]}
      >
        <Spacer />
        <Button
          label="Confirmar"
          modifiers={[
            roundedFont({}),
            buttonStyle('glassProminent'),
            controlSize('large'),
            padding({ top: 4 }),
            disabledModifier(!selectedItem),
          ]}
          onPress={() => {
            if (!selectedItem) return;

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
    </VStack>
  );

  const listView = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ top: -38 }),
      ]}
    >
      <List
        modifiers={[
          listStyle('insetGrouped'),
          scrollDisabled(false),
          scrollContentBackground('hidden'),
          padding({ horizontal: 0, bottom: 0 }),
        ]}
      >
        {items.map((item) => (
          <HStack
            key={item.id}
            alignment="center"
            spacing={14}
            modifiers={[
              frame({ height: 36, maxWidth: 1000 }),
              listRowBackground('clear'),
              contentShape(shapes.rectangle()),
              onTapGesture(() => handleSelect(item)),
              accessibilityLabel(item.title),
            ]}
          >
            <Image
              color="#8B8B93"
              size={26}
              systemName={(item.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
            />
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[roundedFont({ size: 17, weight: 'regular' })]}>{item.title}</Text>
              <Text modifiers={[foregroundColor('#8B8B93'), roundedFont({ size: 14 })]}>
                {item.subtitle ?? 'Selecionar'}
              </Text>
            </VStack>
            <Spacer />
            <Image color="#8B8B93" size={15} systemName="chevron.right" />
          </HStack>
        ))}
      </List>
    </VStack>
  );

  const headerView = (
    <ZStack
      alignment="center"
      modifiers={[frame({ maxWidth: 1000 }), hidden(Boolean(selectedItem))]}
    >
      {titleView}
    </ZStack>
  );

  const registroSheetContent = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        padding({ horizontal: 0, top: 12, bottom: 0 }),
      ]}
    >
      <Spacer minLength={8} />
      {headerView}
      <Spacer minLength={8} />
      <NativeInteractivePager
        fillWidth
        initialPage={0}
        onPageSettled={({ nativeEvent: { page } }) => onPageSettled?.(page)}
        requestID={pageRequestID}
        requestedPage={selectedItem ? 1 : 0}
      >
        <NativeInteractivePagerPage page={0}>{listView}</NativeInteractivePagerPage>
        <NativeInteractivePagerPage page={1}>{detailView}</NativeInteractivePagerPage>
      </NativeInteractivePager>
    </VStack>
  );

  const sheetContent = content ?? registroSheetContent;
  const sheetDetents =
    detents ??
    (initialDetent
      ? ([initialDetent, 'large'] as const)
      : ([{ fraction: 0.48 }, 'large'] as const));

  const handleIsPresentedChange = (nextVisible: boolean) => {
    if (__DEV__) {
      console.log('[native-bottom-sheet-flow]', {
        timestampMs: Date.now(),
        event: 'is-presented-change',
        title,
        visible: nextVisible,
      });
    }
    onVisibleChange(nextVisible);
  };

  const handleDetentChange = (detent: PresentationDetent) => {
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
      matchContents={hostSizing === 'content' ? { horizontal: true } : false}
      useViewportSizeMeasurement={hostSizing === 'viewport'}
    >
      <BottomSheet
        isPresented={visible}
        onDismiss={() => {
          if (__DEV__) {
            console.log('[native-bottom-sheet-flow]', {
              timestampMs: Date.now(),
              event: 'dismiss-completed',
              title,
            });
          }
          onDismiss?.();
        }}
        onIsPresentedChange={handleIsPresentedChange}
      >
        <Group
          modifiers={[
            presentationDetents(
              [...sheetDetents],
              initialDetent || onDetentChange
                ? {
                    ...(initialDetent ? { selection: initialDetent } : {}),
                    ...(onDetentChange ? { onSelectionChange: handleDetentChange } : {}),
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
