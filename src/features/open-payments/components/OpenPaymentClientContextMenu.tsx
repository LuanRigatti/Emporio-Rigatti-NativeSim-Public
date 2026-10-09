import { NativeCardContextMenu } from '@/components/native';

import type { OpenPaymentClientContextMenuProps } from './OpenPaymentClientContextMenu.types';

export function OpenPaymentClientContextMenu(props: OpenPaymentClientContextMenuProps) {
  return (
    <NativeCardContextMenu actions={props.actions} style={props.style} preview={props.preview}>
      {props.children}
    </NativeCardContextMenu>
  );
}
