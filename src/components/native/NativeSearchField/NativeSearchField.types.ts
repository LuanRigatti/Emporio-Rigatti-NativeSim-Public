export type NativeSearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
  focusRequestKey?: number;
  blurRequestKey?: number;
  hapticOnFocus?: boolean;
  /** Uses the native SwiftUI keyboard toolbar on iOS when enabled. */
  keyboardAccessory?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onPressHelp?: () => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  /** Changes only when the owning route enters focus, not on ordinary renders. */
  focusEntryKey?: number;
};
