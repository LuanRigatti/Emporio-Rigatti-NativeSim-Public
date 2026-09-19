export type NativeHomeToolbarActionsProps = {
  name: string;
  imageUri?: string | null;
  foregroundColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  searchAccessibilityLabel?: string;
  onProfilePress: () => void;
  onSearchPress?: () => void;
  showSearch?: boolean;
};
