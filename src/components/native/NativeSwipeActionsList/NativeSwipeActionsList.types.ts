import type { SFSymbol } from 'sf-symbols-typescript';

export type NativeSwipeActionsListItem = {
  id: string;
  overline: string;
  title: string;
  titleBold?: boolean;
  subtitle: string;
  trailingText: string;
  trailingSystemImage?: SFSymbol;
  trailingSystemImageColor?: string;
};

export type NativeSwipeActionsListAction = {
  label: string;
  role?: 'default' | 'cancel' | 'destructive';
  systemImage: SFSymbol;
  tint?: string;
};

export type NativeSwipeActionsListColors = {
  textPrimary: string;
  textSecondary: string;
  border: string;
  selectionSurface: string;
  selectionContent: string;
};

export type NativeSwipeActionsListProps = {
  items: readonly NativeSwipeActionsListItem[];
  colors: NativeSwipeActionsListColors;
  isSelectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onItemPress?: (id: string) => void;
  onDelete: (id: string) => void;
  action?: NativeSwipeActionsListAction;
  trailingValueAlignment?: 'center' | 'top';
};
