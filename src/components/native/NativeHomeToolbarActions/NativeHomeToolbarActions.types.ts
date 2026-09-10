export type NativeHomeToolbarActionsProps = {
  name: string;
  imageUri?: string | null;
  foregroundColor?: string;
  glassTint?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  searchAccessibilityLabel?: string;
  onProfilePress: () => void;
  onSearchPress: () => void;
};
