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
  zIndex,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetSwiftUI({
  items,
  bucketPrice = 49.8,
  onDismiss,
  onSelect,
  onVisibleChange,
  subtitle,
  title,
  visible,
  onConfirm,
  presentationStep,
  selectedItem: controlledSelectedItem,
  initialQuantity,
}: NativeBottomSheetProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bucketQuantity, setBucketQuantity] = useState(1);
  const [internalFormVisible, setInternalFormVisible] = useState(false);
  const selectedItem = controlledSelectedItem ?? items.find((item) => item.id === selectedItemId);
  const isFormVisible =
    presentationStep === 'form' ? true : presentationStep === 'list' ? false : internalFormVisible;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setSelectedItemId(null);
      setInternalFormVisible(false);
      setBucketQuantity(1);
      setSelectedDate(new Date());
    }
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible && presentationStep === 'form' && initialQuantity != null) {
      setBucketQuantity(Math.max(1, Math.round(initialQuantity)));
    }
  }, [initialQuantity, presentationStep, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSelect = (item: (typeof items)[number]) => {
    setSelectedItemId(item.id);
    setInternalFormVisible(true);
    onSelect?.(item);
  };

  const titleView = (
    <HStack
      alignment="center"
      spacing={6}
      modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}
    >
      <Text modifiers={[font({ size: 17, weight: 'bold' }), offset({ y: isFormVisible ? 20 : 6 })]}>
        {title}
      </Text>
    </HStack>
  );

  const detailView = selectedItem ? (
    <List
      modifiers={[
        listStyle('insetGrouped'),
        scrollDisabled(true),
        scrollContentBackground('hidden'),
        background('systemGray5'),
        padding({ horizontal: 0, top: -8, bottom: 8 }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[
          frame({ minHeight: 300, alignment: 'top' }),
          listRowBackground('clear'),
          padding({ top: 20, bottom: 22 }),
        ]}
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
            <Text modifiers={[font({ size: 18, weight: 'semibold' })]}>{selectedItem.title}</Text>
          </HStack>
          <Divider />
        </VStack>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[padding({ top: 22 }), offset({ y: -10 })]}
        >
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
              }).format(bucketPrice * bucketQuantity)}
            </Text>
          </HStack>
        </VStack>
        <Spacer minLength={0} />
        <HStack alignment="center" modifiers={[offset({ y: -18 })]}>
          <Spacer />
          <Button
            label="Confirmar"
            modifiers={[buttonStyle('glassProminent'), controlSize('large'), padding({ top: 4 })]}
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
          />
        </HStack>
      </VStack>
    </List>
  ) : null;

  const listView = (
    <VStack alignment="leading" spacing={0} modifiers={[padding({ top: -6 })]}>
      <Text
        modifiers={[
          foregroundColor('#8B8B93'),
          font({ size: 15, weight: 'semibold' }),
          padding({ horizontal: 28 }),
          offset({ y: 26 }),
          zIndex(1),
        ]}
      >
        {subtitle ?? 'Escolha o cliente'}
      </Text>
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

  const headerView = (showCancel: boolean) => (
    <ZStack alignment="center" modifiers={[frame({ maxWidth: 1000 })]}>
      {showCancel ? (
        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: 1000, alignment: 'leading' }), padding({ horizontal: 16 })]}
        >
          <Button
            label="Cancelar"
            modifiers={[
              buttonStyle('plain'),
              controlSize('regular'),
              foregroundColor('#8B8B93'),
              padding({ horizontal: 12, vertical: 12 }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'capsule',
              }),
              accessibilityLabel('Cancelar'),
            ]}
            onPress={() => onVisibleChange(false)}
          />
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
            disabledModifier(isFormVisible),
          ]}
        >
          {listView}
        </VStack>
        <VStack
          modifiers={[
            offset({ y: isFormVisible ? 0 : 1000 }),
            animation(Animation.easeInOut({ duration: 0.4 }), isFormVisible),
            disabledModifier(!isFormVisible),
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
        isPresented={visible}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) {
            setSelectedItemId(null);
            setInternalFormVisible(false);
          }
          onVisibleChange(isPresented);
        }}
        onDismiss={onDismiss}
      >
        <Group
          modifiers={[
            presentationDetents([{ fraction: 0.54 }, 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          {sheetContent}
        </Group>
      </BottomSheet>
    </Host>
  );
}
