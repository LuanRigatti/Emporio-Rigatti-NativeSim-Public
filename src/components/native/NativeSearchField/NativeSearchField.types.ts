export type NativeSearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onSubmit?: () => void;
  placeholder?: string;
  accessibilityLabel?: string;
};
