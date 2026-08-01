import { StyleSheet, View } from 'react-native';

import NativeDropdown from '../NativeDropdown';
import type { NativePeriodActionGroupProps } from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupFallback({
  color,
  monthItems,
  onMonthChange,
  onYearChange,
  selectedMonth,
  selectedYear,
  yearItems,
}: NativePeriodActionGroupProps) {
  return (
    <View style={styles.group}>
      <NativeDropdown
        color={color}
        items={monthItems}
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
