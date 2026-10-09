import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';

import { NativeCardContextMenu } from '@/components/native';
import type {
  NativeContextMenuActionEvent,
  NativeContextMenuPreviewViewProps,
} from 'native-card-context-menu';

import type { OpenPaymentClientContextMenuProps } from './OpenPaymentClientContextMenu.types';

const supportsNativePeekPop =
  requireOptionalNativeModule('NativeContextMenuPreview') !== null &&
  requireOptionalNativeModule('NativeOpenPaymentContextMenuHost') !== null;
const NativePreviewView: ComponentType<NativeContextMenuPreviewViewProps> | null =
  supportsNativePeekPop ? requireNativeView('NativeContextMenuPreview') : null;

export function OpenPaymentClientContextMenu({
  actions,
  children,
  identifier,
  nativePreview,
  nativePeekPopEnabled,
  preview,
  style,
}: OpenPaymentClientContextMenuProps) {
  if (!nativePeekPopEnabled || !NativePreviewView) {
    return (
      <NativeCardContextMenu actions={actions} preview={preview} style={style}>
        {children}
      </NativeCardContextMenu>
    );
  }

  const actionsById = new Map(actions.map((action) => [action.id, action]));
  return (
    <NativePreviewView
      actions={actions.map(({ destructive, disabled, id, systemImage, title }) => ({
        destructive,
        disabled,
        id,
        systemImage,
        title,
      }))}
      identifier={identifier}
      onAction={(event: NativeContextMenuActionEvent) =>
        actionsById.get(event.nativeEvent.actionId)?.onPress()
      }
      preview={nativePreview}
      presentationStyle="page"
      style={style}
    >
      {children}
    </NativePreviewView>
  );
}
