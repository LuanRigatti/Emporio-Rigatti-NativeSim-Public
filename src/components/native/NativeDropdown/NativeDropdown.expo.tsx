import { NativePicker } from '../NativePicker';
import type { NativeDropdownProps } from './NativeDropdown.types';

export default function NativeDropdownExpo<T extends string | number>({
  accessibilityLabel,
  items,
  label,
  onValueChange,
  selectedValue,
}: NativeDropdownProps<T>) {
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selectedValue),
  );

  return (
    <NativePicker
      accessibilityLabel={accessibilityLabel}
      label={label ?? items[selectedIndex]?.label}
      onSelectedIndexChange={(index) => {
        const item = items[index];
        if (item && !item.disabled) {
          onValueChange(item.value);
        }
      }}
      options={items.map((item) => item.label)}
      selectedIndex={selectedIndex}
    />
  );
}
