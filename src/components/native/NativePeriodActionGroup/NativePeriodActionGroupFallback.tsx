import { StyleSheet, View } from 'react-native';

import NativeDropdown from '../NativeDropdown';
import type { NativePeriodActionGroupProps } from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupFallback({
  color,
  dayItems,
  monthDisplayValue,
  monthItems,
  onDayChange,
  onMonthChange,
  onYearChange,
  selectedDay,
  selectedMonth,
  selectedYear,
  yearItems,
}: NativePeriodActionGroupProps) {
  return (
    <View style={styles.group}>
      {dayItems && onDayChange && selectedDay ? (
        <NativeDropdown
          color={color}
          items={dayItems}
          onValueChange={onDayChange}
          selectedValue={selectedDay}
          variant="glass"
        />
      ) : null}
      <NativeDropdown
        color={color}
        items={monthItems}
        label={monthDisplayValue}
        onValueChange={onMonthChange}
        selectedValue={selectedMonth}
        variant="glass"
      />
      <NativeDropdown
        color={color}
        items={yearItems}
        onValueChange={onYearChange}
        selectedValue={selectedYear}
        variant="glass"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
