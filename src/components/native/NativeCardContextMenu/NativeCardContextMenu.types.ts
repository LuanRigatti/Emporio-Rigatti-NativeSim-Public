import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

export type NativeCardContextMenuAction = {
  id: string;
  title: string;
  systemImage: SFSymbol;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export type NativeCardContextMenuProps = {
  children: ReactNode;
  actions: readonly NativeCardContextMenuAction[];
  title?: string;
};
