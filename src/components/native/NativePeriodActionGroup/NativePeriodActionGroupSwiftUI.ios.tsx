import { HStack, Host } from '@expo/ui/swift-ui';
import { frame, glassEffect, padding } from '@expo/ui/swift-ui/modifiers';

import { triggerSelectionHaptic } from '@/utils/haptics';

import { NativeDropdownMenuSwiftUI } from '../NativeDropdown/NativeDropdownMenuSwiftUI';
import type { NativePeriodActionGroupProps } from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupSwiftUI({
  color,
  monthItems,
  onMonthChange,
  onYearChange,
  selectedMonth,
  selectedYear,
  yearItems,
}: NativePeriodActionGroupProps) {
  const monthItem = monthItems.find((item) => item.value === selectedMonth) ?? monthItems[0];
  const yearItem = yearItems.find((item) => item.value === selectedYear) ?? yearItems[0];

  return (
    <Host matchContents>
      <HStack
        spacing={4}
        modifiers={[
          padding({ horizontal: 6, vertical: 0 }),
          frame({ width: 104, height: 44, alignment: 'center' }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
        ]}
      >
        <NativeDropdownMenuSwiftUI
          accessibilityLabel="Mês selecionado"
          color={color}
          displayValue={monthItem?.label ?? String(selectedMonth)}
          hapticOnOpen={triggerSelectionHaptic}
          iconOnly
          items={monthItems}
          leadingSystemImage="calendar"
          onValueChange={onMonthChange}
          selectedValue={selectedMonth}
          variant="plain"
        />
        <NativeDropdownMenuSwiftUI
          accessibilityLabel="Ano selecionado"
          color={color}
          displayValue={yearItem?.label ?? String(selectedYear)}
          hapticOnOpen={triggerSelectionHaptic}
          iconOnly
          items={yearItems}
          leadingSystemImage="calendar.badge.clock"
          onValueChange={onYearChange}
          selectedValue={selectedYear}
          variant="plain"
        />
      </HStack>
    </Host>
  );
}
