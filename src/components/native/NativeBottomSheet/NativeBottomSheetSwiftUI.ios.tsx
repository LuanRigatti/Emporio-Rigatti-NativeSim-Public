import {
  BottomSheet,
  Button,
  DateTimePicker,
  Divider,
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
  disabled,
  frame,
  glassEffect,
  offset,
  padding,
  zIndex,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  onSelect,
  onVisibleChange,
  subtitle,
  title,
  visible,
  onConfirm,
}: NativeBottomSheetProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const selectedItem = items.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (!visible) {
      setSelectedItemId(null);
      setIsFormVisible(false);
      setBucketQuantity(1);
      setSelectedDate(new Date());
    }
  }, [visible]);

  const handleSelect = (item: (typeof items)[number]) => {
    setSelectedItemId(item.id);
    setIsFormVisible(true);
    onSelect?.(item);
  };

  const titleView = (
    <HStack
      alignment="center"
      spacing={6}
      modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
    >
      <Text size={17} weight="bold" modifiers={[offset({ y: isFormVisible ? 20 : 6 })]}>
        {title}
      </Text>
    </HStack>
  );

  const detailView = selectedItem ? (
    <List
      listStyle="insetGrouped"
      scrollEnabled={false}
      modifiers={[padding({ horizontal: 0, top: -8, bottom: 8 })]}
    >
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[frame({ minHeight: 300, alignment: 'top' }), padding({ top: 20, bottom: 22 })]}
      >
        <VStack alignment="leading" spacing={16} modifiers={[offset({ y: -10 })]}>
          <HStack
            alignment="center"
            spacing={10}
            modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
          >
            <Image
              color="#8B8B93"
              size={32}
              systemName={(selectedItem.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
            />
            <Text size={18} weight="semibold">
              {selectedItem.title}
            </Text>
          </HStack>
          <Divider />
        </VStack>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[padding({ top: 22 }), offset({ y: -10 })]}
        >
          <HStack alignment="center" spacing={10} modifiers={[padding({ bottom: 18 })]}>
            <Text size={16} weight="bold">
              Data da entrega
            </Text>
            <Spacer />
            <DateTimePicker
              displayedComponents="date"
              initialDate={selectedDate.toISOString()}
              onDateSelected={setSelectedDate}
              variant="compact"
            />
          </HStack>
          <HStack alignment="center" spacing={16}>
            <Text size={17} weight="semibold">
              {`${bucketQuantity} ${bucketQuantity === 1 ? 'balde' : 'baldes'}`}
            </Text>
            <Spacer />
            <Button
              controlSize="regular"
              modifiers={[
                buttonStyle('plain'),
                frame({ width: 44, height: 44 }),
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
                accessibilityLabel('Diminuir quantidade'),
              ]}
              onPress={() => setBucketQuantity((value) => Math.max(1, value - 1))}
            >
              <Image size={17} systemName="minus" />
            </Button>
            <Button
              controlSize="regular"
              modifiers={[
                buttonStyle('plain'),
                frame({ width: 44, height: 44 }),
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
                accessibilityLabel('Aumentar quantidade'),
              ]}
              onPress={() => setBucketQuantity((value) => value + 1)}
            >
              <Image size={17} systemName="plus" />
            </Button>
          </HStack>
          <HStack alignment="center" modifiers={[padding({ top: 24 })]}>
            <Text size={16} weight="bold">
              Valor total
            </Text>
            <Spacer />
            <Text size={17} weight="semibold">
              {new Intl.NumberFormat('pt-BR', {
                currency: 'BRL',
                style: 'currency',
              }).format(bucketPrice * bucketQuantity)}
            </Text>
          </HStack>
        </VStack>
        <Spacer minLength={0} />
        <HStack alignment="center" modifiers={[offset({ y: -18 })]}>
          <Spacer />
          <Button
            controlSize="large"
            modifiers={[buttonStyle('glassProminent'), padding({ top: 4 })]}
            onPress={() => {
              if (selectedItem) {
                onConfirm?.({
                  bucketPrice,
                  client: selectedItem,
                  date: selectedDate,
                  quantity: bucketQuantity,
                });
              }
              onVisibleChange(false);
            }}
          >
            Confirmar
          </Button>
        </HStack>
      </VStack>
    </List>
  ) : null;

  const listView = (
    <VStack alignment="leading" spacing={0} modifiers={[padding({ top: -6 })]}>
      <Text
        color="#8B8B93"
        size={15}
        weight="semibold"
        modifiers={[padding({ horizontal: 28 }), offset({ y: 26 }), zIndex(1)]}
      >
        {subtitle ?? 'Escolha o cliente'}
      </Text>
      <List
        listStyle="insetGrouped"
        scrollEnabled
        modifiers={[background('systemGray5'), padding({ horizontal: 0, bottom: 8 })]}
      >
        {items.map((item) => (
          <HStack
            key={item.id}
            {...({
              onPress: () => handleSelect(item),
              useTapGesture: true,
            } as { onPress: () => void; useTapGesture: boolean })}
            alignment="center"
            spacing={14}
            modifiers={[frame({ height: 36, maxWidth: 1000 }), accessibilityLabel(item.title)]}
          >
            <Image
              color="#8B8B93"
              size={26}
              systemName={(item.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
            />
            <VStack alignment="leading" spacing={0}>
              <Text size={17} weight="regular">
                {item.title}
              </Text>
              <Text color="#8B8B93" size={14}>
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

  const headerView = (showCancel: boolean) => (
    <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
      {showCancel ? (
        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: 1000, alignment: 'leading' }), padding({ horizontal: 16 })]}
        >
          <Button
            color="#8B8B93"
            controlSize="regular"
            modifiers={[
              buttonStyle('plain'),
              padding({ horizontal: 12, vertical: 12 }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'capsule',
              }),
              accessibilityLabel('Cancelar'),
            ]}
            onPress={() => onVisibleChange(false)}
          >
            Cancelar
          </Button>
          <Spacer />
        </HStack>
      ) : null}
      {titleView}
    </ZStack>
  );
  const sheetContent = (
    <VStack
      alignment="leading"
      spacing={isFormVisible ? -4 : 0}
      modifiers={[padding({ horizontal: 0, top: 12, bottom: 6 })]}
    >
      <Spacer minLength={isFormVisible ? 0 : 16} />
      {headerView(!isFormVisible)}
      <ZStack
        alignment="top"
        modifiers={[frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'top' })]}
      >
        <VStack
          modifiers={[
            offset({ y: isFormVisible ? 1000 : 0 }),
            animation(Animation.easeInOut({ duration: 0.4 }), isFormVisible),
            disabled(isFormVisible),
          ]}
        >
          {listView}
        </VStack>
        <VStack
          modifiers={[
            offset({ y: isFormVisible ? 0 : 1000 }),
            animation(Animation.easeInOut({ duration: 0.4 }), isFormVisible),
            disabled(!isFormVisible),
          ]}
        >
          {detailView}
        </VStack>
      </ZStack>
    </VStack>
  );

  return (
    <Host matchContents>
      <BottomSheet
        isOpened={visible}
        onIsOpenedChange={(isOpened) => {
          if (!isOpened) {
            setSelectedItemId(null);
            setIsFormVisible(false);
          }
          onVisibleChange(isOpened);
        }}
        presentationDetents={[0.54, 'large']}
        presentationDragIndicator="visible"
      >
        {sheetContent}
      </BottomSheet>
    </Host>
  );
}
