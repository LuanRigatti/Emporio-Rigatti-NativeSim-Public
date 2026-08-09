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
  background,
  buttonStyle,
  contentShape,
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
  presentationBackground,
  presentationDragIndicator,
  scrollContentBackground,
  scrollDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { NativeInteractivePager, NativeInteractivePagerPage } from '../NativeInteractivePager';
import {
  NATIVE_SHEET_CARD_BACKGROUND,
  NATIVE_SHEET_PRESENTATION_BACKGROUND,
} from '../nativeSheetBackground';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';
import { roundedFont } from '../nativeTypography';

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  content,
  onSelect,
  onPageSettled,
  onVisibleChange,
  title,
  visible,
  onConfirm,
  selectedItem: controlledSelectedItem,
  initialQuantity,
  initialDetent,
}: NativeBottomSheetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [pageRequestID, setPageRequestID] = useState(0);
  const selectedItem = controlledSelectedItem ?? null;
  const effectiveBucketPrice = selectedItem?.bucketPrice ?? bucketPrice;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setBucketQuantity(1);
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
            NATIVE_SHEET_CARD_BACKGROUND,
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
                frame({ width: 40, height: 40 }),
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
                accessibilityLabel('Diminuir quantidade'),
                disabledModifier(!selectedItem),
              ]}
              onPress={() => setBucketQuantity((value) => Math.max(1, value - 1))}
            >
              <Image size={17} systemName="minus" />
            </Button>
            <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>
              {bucketQuantity}
            </Text>
            <Button
              modifiers={[
                buttonStyle('plain'),
                controlSize('regular'),
                frame({ width: 40, height: 40 }),
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
                accessibilityLabel('Aumentar quantidade'),
                disabledModifier(!selectedItem),
              ]}
              onPress={() => setBucketQuantity((value) => value + 1)}
            >
              <Image size={17} systemName="plus" />
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
            NATIVE_SHEET_CARD_BACKGROUND,
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
    <VStack alignment="leading" spacing={0} modifiers={[padding({ top: -38 })]}>
      <List
        modifiers={[
          listStyle('insetGrouped'),
          scrollDisabled(false),
          scrollContentBackground('hidden'),
          padding({ horizontal: 0, bottom: 8 }),
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
      modifiers={[padding({ horizontal: 0, top: 12, bottom: 6 })]}
    >
      <Spacer minLength={8} />
      {headerView}
      <Spacer minLength={8} />
      <NativeInteractivePager
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
  const sheetDetents = initialDetent
    ? ([initialDetent, 'large'] as const)
    : ([{ fraction: 0.48 }, 'large'] as const);

  return (
    <Host matchContents={{ horizontal: true }}>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            presentationBackground(NATIVE_SHEET_PRESENTATION_BACKGROUND),
            presentationDetents(
              [...sheetDetents],
              initialDetent ? { selection: initialDetent } : undefined,
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
