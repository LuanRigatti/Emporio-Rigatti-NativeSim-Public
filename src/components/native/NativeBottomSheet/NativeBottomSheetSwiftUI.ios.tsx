import {
  BottomSheet,
  Button,
  DateTimePicker,
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
      <Text size={17} weight="bold">
        {title}
      </Text>
    </HStack>
  );

  const detailView = selectedItem ? (
    <List listStyle="insetGrouped" scrollEnabled={false} modifiers={[padding({ horizontal: 0 })]}>
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[
          frame({ minHeight: 300, maxHeight: 1000, alignment: 'top' }),
          padding({ top: 20, bottom: 22 }),
        ]}
      >
        <HStack alignment="center" spacing={10}>
          <Image
            color="#8B8B93"
            size={28}
            systemName={(selectedItem.systemImage ?? 'person.crop.circle.fill') as SFSymbol}
          />
          <Text size={17} weight="semibold">
            {selectedItem.title}
          </Text>
        </HStack>
        <VStack alignment="leading" spacing={0} modifiers={[padding({ top: 22 })]}>
          <HStack alignment="center" spacing={10} modifiers={[padding({ bottom: 18 })]}>
            <Text size={14}>Data da entrega</Text>
            <Spacer />
            <DateTimePicker
              displayedComponents="date"
              initialDate={selectedDate.toISOString()}
              onDateSelected={setSelectedDate}
              variant="compact"
            />
          </HStack>
          <HStack alignment="center" spacing={16} modifiers={[padding({ top: 10 })]}>
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
        </VStack>
        <Spacer minLength={32} />
        <HStack alignment="center">
          <Spacer />
          <Button
            controlSize="large"
            modifiers={[buttonStyle('glassProminent'), padding({ top: 4 })]}
            onPress={() => {
              if (selectedItem) {
                onConfirm?.({ client: selectedItem, date: selectedDate, quantity: bucketQuantity });
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
    <VStack alignment="leading" spacing={0} modifiers={[padding({ top: 14 })]}>
      <Text
        color="#8B8B93"
        size={15}
        weight="semibold"
        modifiers={[padding({ horizontal: 16 }), offset({ y: 20 }), zIndex(1)]}
      >
        {subtitle ?? 'Escolha o cliente'}
      </Text>
      <List listStyle="insetGrouped" scrollEnabled modifiers={[padding({ horizontal: 0 })]}>
        {items.map((item) => (
          <HStack
            key={item.id}
            {...({
              onPress: () => handleSelect(item),
              useTapGesture: true,
            } as { onPress: () => void; useTapGesture: boolean })}
            alignment="center"
            spacing={14}
            modifiers={[
              frame({ maxWidth: 1000 }),
              padding({ horizontal: 16, vertical: 3 }),
              accessibilityLabel(item.title),
            ]}
          >
            <VStack alignment="leading" spacing={3}>
              <Text size={17} weight="semibold">
                {item.title}
              </Text>
              <Text size={14}>{item.subtitle ?? 'Selecionar'}</Text>
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
              padding({ horizontal: 12, vertical: 6 }),
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
      spacing={0}
      modifiers={[padding({ horizontal: 0, top: 12, bottom: 6 })]}
    >
      <Spacer minLength={16} />
      {headerView(!isFormVisible)}
      <ZStack
        alignment="top"
        modifiers={[frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'top' })]}
      >
        <VStack
          modifiers={[
            offset({ x: isFormVisible ? -1000 : 0 }),
            animation(Animation.easeInOut({ duration: 0.4 }), isFormVisible),
            disabled(isFormVisible),
          ]}
        >
          {listView}
        </VStack>
        <VStack
          modifiers={[
            offset({ x: isFormVisible ? 0 : 1000 }),
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
    <Host style={{ flex: 1 }}>
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
