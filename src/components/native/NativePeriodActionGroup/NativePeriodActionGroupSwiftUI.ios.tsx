import { useState } from 'react';

import { Button, DatePicker, HStack, Host, Image, Popover } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  datePickerStyle,
  frame,
  glassEffect,
  labelsHidden,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { triggerSelectionHaptic } from '@/utils/haptics';

import { NativeDropdownMenuSwiftUI } from '../NativeDropdown/NativeDropdownMenuSwiftUI';
import {
  getNativePeriodActionGroupWidth,
  type NativePeriodActionGroupProps,
} from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupSwiftUI({
  color,
  dayItems,
  dayPicker = false,
  monthDisplayValue,
  monthItems,
  onDayChange,
  onMonthChange,
  onYearChange,
  selectedDay,
  selectedMonth,
  selectedYear,
  showValues = false,
  valueFontSize,
  yearItems,
}: NativePeriodActionGroupProps) {
  const dayItem = dayItems?.find((item) => item.value === selectedDay) ?? dayItems?.[0];
  const monthItem = monthItems.find((item) => item.value === selectedMonth) ?? monthItems[0];
  const yearItem = yearItems.find((item) => item.value === selectedYear) ?? yearItems[0];
  const includesDay = Boolean(dayItems?.length && onDayChange && selectedDay);

  const selectedDate = selectedDay ? parseIsoDate(selectedDay) : undefined;
  const [isDatePickerPresented, setIsDatePickerPresented] = useState(false);

  return (
    <Host matchContents>
      <HStack
        spacing={showValues ? 0 : 4}
        modifiers={[
          padding({ horizontal: 6, vertical: 0 }),
          frame({
            width: getNativePeriodActionGroupWidth({
              dayItems,
              onDayChange,
              selectedDay,
              showValues,
            }),
            height: 44,
            alignment: 'center',
          }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
        ]}
      >
        {includesDay && dayPicker && selectedDate ? (
          <Popover
            arrowEdge="top"
            isPresented={isDatePickerPresented}
            onIsPresentedChange={setIsDatePickerPresented}
          >
            <Popover.Trigger>
              <Button
                modifiers={[
                  accessibilityLabel('Selecionar data'),
                  buttonStyle('plain'),
                  frame({ width: 44, height: 44, alignment: 'center' }),
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setIsDatePickerPresented(true);
                }}
              >
                <Image color={color} size={18} systemName="calendar.day.timeline.left" />
              </Button>
            </Popover.Trigger>
            <Popover.Content>
              <DatePicker
                displayedComponents={['date']}
                modifiers={[datePickerStyle('graphical'), labelsHidden()]}
                onDateChange={(date) => onDayChange!(formatIsoDate(date))}
                selection={selectedDate}
              />
            </Popover.Content>
          </Popover>
        ) : includesDay ? (
          <NativeDropdownMenuSwiftUI
            accessibilityLabel="Data selecionada"
            color={color}
            displayValue={dayItem?.label ?? selectedDay!}
            hapticOnOpen={triggerSelectionHaptic}
            iconOnly
            items={dayItems!}
            leadingSystemImage="calendar.day.timeline.left"
            onValueChange={onDayChange!}
            selectedValue={selectedDay!}
            variant="plain"
          />
        ) : null}
        <NativeDropdownMenuSwiftUI
          accessibilityLabel="Mês selecionado"
          color={color}
          compact={showValues}
          displayValue={monthDisplayValue ?? monthItem?.label ?? String(selectedMonth)}
          fontSize={valueFontSize}
          hapticOnOpen={triggerSelectionHaptic}
          hideChevron={showValues}
          iconOnly={!showValues}
          items={monthItems}
          leadingSystemImage={showValues ? undefined : 'calendar'}
          onValueChange={onMonthChange}
          selectedValue={selectedMonth}
          variant="plain"
        />
        <NativeDropdownMenuSwiftUI
          accessibilityLabel="Ano selecionado"
          color={color}
          compact={showValues}
          displayValue={
            showValues ? String(selectedYear) : (yearItem?.label ?? String(selectedYear))
          }
          fontSize={valueFontSize}
          hapticOnOpen={triggerSelectionHaptic}
          hideChevron={showValues}
          iconOnly={!showValues}
          items={yearItems}
          leadingSystemImage={showValues ? undefined : 'calendar.badge.clock'}
          onValueChange={onYearChange}
          selectedValue={selectedYear}
          variant="plain"
        />
      </HStack>
    </Host>
  );
}

function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12);
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}
