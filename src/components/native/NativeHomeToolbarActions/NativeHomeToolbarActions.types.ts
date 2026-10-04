type NativeHomeToolbarActionsBaseProps = {
  name: string;
  imageUri?: string | null;
  foregroundColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  searchAccessibilityLabel?: string;
  searchAccessibilityHint?: string;
};

type NativeHomeToolbarProfileActionsProps = NativeHomeToolbarActionsBaseProps & {
  mode?: 'profileActions';
  onProfilePress: () => void;
  onSearchPress?: () => void;
  showSearch?: boolean;
};

type NativeHomeToolbarSearchActionProps = NativeHomeToolbarActionsBaseProps & {
  mode: 'searchAction';
  onProfilePress?: never;
  onSearchPress: () => void;
  showSearch?: never;
};

export type NativeHomeToolbarActionsProps =
  NativeHomeToolbarProfileActionsProps | NativeHomeToolbarSearchActionProps;
