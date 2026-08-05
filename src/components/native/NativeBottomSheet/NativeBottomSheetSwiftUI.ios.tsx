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
  font,
  foregroundColor,
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
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { NativeInteractivePager, NativeInteractivePagerPage } from '../NativeInteractivePager';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  onSelect,
  onPageSettled,
  onVisibleChange,
  title,
  visible,
  onConfirm,
  selectedItem: controlledSelectedItem,
  initialQuantity,
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
      <Text modifiers={[font({ size: 15, weight: 'bold' }), offset({ y: -6 })]}>{title}</Text>
    </HStack>
  );

  const detailView = (
    <VStack
      alignment="leading"
      spacing={12}
      modifiers={[
        background('systemGray5'),
        frame({ maxWidth: 1000, alignment: 'top' }),
        padding({ horizontal: 20, top: 14, bottom: 16 }),
      ]}
    >
      <VStack alignment="leading" spacing={12}>
        <VStack alignment="leading" spacing={12}>
          <HStack
            alignment="center"
            spacing={10}
            modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
          >
            <Image
              color="#8B8B93"
              size={32}
              systemName={(selectedItem?.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
            />
            <Text modifiers={[font({ size: 18, weight: 'semibold' })]}>
              {selectedItem?.title ?? 'Selecione um cliente'}
            </Text>
          </HStack>
          <Divider />
        </VStack>
        <VStack alignment="leading" spacing={0} modifiers={[padding({ top: 8 })]}>
          <HStack alignment="center" spacing={10} modifiers={[padding({ bottom: 18 })]}>
            <Text modifiers={[font({ size: 16, weight: 'bold' })]}>Data da entrega</Text>
            <Spacer />
            <DatePicker
              displayedComponents={['date']}
              onDateChange={setSelectedDate}
              selection={selectedDate}
            />
          </HStack>
          <HStack alignment="center" spacing={16}>
            <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
              {`${bucketQuantity} ${bucketQuantity === 1 ? 'balde' : 'baldes'}`}
            </Text>
            <Spacer />
            <Button
              modifiers={[
                buttonStyle('plain'),
                controlSize('regular'),
                frame({ width: 44, height: 44 }),
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
            <Button
              modifiers={[
                buttonStyle('plain'),
                controlSize('regular'),
                frame({ width: 44, height: 44 }),
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
          <HStack alignment="center" modifiers={[padding({ top: 24 })]}>
            <Text modifiers={[font({ size: 16, weight: 'bold' })]}>Valor total</Text>
            <Spacer />
            <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
              {new Intl.NumberFormat('pt-BR', {
                currency: 'BRL',
                style: 'currency',
              }).format(effectiveBucketPrice * bucketQuantity)}
            </Text>
          </HStack>
        </VStack>
        <HStack alignment="center" modifiers={[padding({ top: 4 })]}>
          <Spacer />
          <Button
            label="Confirmar"
            modifiers={[
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
    </VStack>
  );

  const listView = (
    <VStack alignment="leading" spacing={0} modifiers={[padding({ top: -38 })]}>
      <List
        modifiers={[
          listStyle('insetGrouped'),
          scrollDisabled(false),
          scrollContentBackground('hidden'),
          background('systemGray5'),
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
              <Text modifiers={[font({ size: 17, weight: 'regular' })]}>{item.title}</Text>
              <Text modifiers={[foregroundColor('#8B8B93'), font({ size: 14 })]}>
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

  const headerView = () => (
    <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
      {titleView}
    </ZStack>
  );

  const sheetContent = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ horizontal: 0, top: 12, bottom: 6 })]}
    >
      <Spacer minLength={16} />
      {headerView()}
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

  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            presentationDetents([{ fraction: 0.48 }, 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          {sheetContent}
        </Group>
      </BottomSheet>
    </Host>
  );
}
