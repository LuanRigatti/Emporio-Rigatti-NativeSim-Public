import { Host } from '@expo/ui/swift-ui';

import type { NativeDropdownProps } from '@/types/native-ui';

import { NativeDropdownMenuSwiftUI } from './NativeDropdownMenuSwiftUI';

export default function NativeDropdownSwiftUI<T extends string | number>({
  accessibilityLabel: label,
  color,
  disabled,
  items,
  label: triggerLabel,
  onValueChange,
  selectedValue,
  variant = 'glass',
}: NativeDropdownProps<T>) {
  const selectedItem = items.find((item) => item.value === selectedValue) ?? items[0];
  const displayValue = triggerLabel?.trim() || selectedItem?.label?.trim() || String(selectedValue);
  return (
    <Host matchContents>
      {disabled ? (
        <NativeDropdownMenuSwiftUI
          accessibilityLabel={label}
          color={color}
          disabled
          displayValue={displayValue}
          items={items}
          onValueChange={onValueChange}
          selectedValue={selectedValue}
          variant="plain"
        />
      ) : (
        <NativeDropdownMenuSwiftUI
          accessibilityLabel={label}
          color={color}
          displayValue={displayValue}
          items={items}
          onValueChange={onValueChange}
          selectedValue={selectedValue}
          variant={variant}
        />
      )}
    </Host>
  );
}
