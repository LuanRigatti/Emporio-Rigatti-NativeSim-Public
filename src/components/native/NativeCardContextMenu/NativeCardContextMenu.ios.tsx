import { Button, ContextMenu, Host, RNHostView, Section } from '@expo/ui/swift-ui';
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  logHistoryLayoutDiagnostics,
  logHistoryLayoutSize,
} from '@/utils/historyLayoutDiagnostics';
import {
  logStartupDiagnostics,
  useStartupDiagnostics,
} from '@/utils/startupLayoutDiagnostics';

import type { NativeCardContextMenuProps } from './NativeCardContextMenu.types';

export default function NativeCardContextMenu({
  actions,
  children,
  preview,
  style,
  title,
  diagnosticsLabel,
  diagnosticsDeliveryId,
}: NativeCardContextMenuProps) {
  const diagnosticsComponent = diagnosticsLabel
    ? `${diagnosticsLabel}.NativeCardContextMenu`
    : 'NativeCardContextMenu';

  useStartupDiagnostics(diagnosticsComponent, {
    actionCount: actions.length,
    hasPreview: Boolean(preview),
  });

  const hasPreview = Boolean(preview);

  useEffect(() => {
    if (!diagnosticsDeliveryId) return;

    logHistoryLayoutDiagnostics(diagnosticsDeliveryId, diagnosticsComponent, 'mount', {
      hasPreview,
    });
    logHistoryLayoutDiagnostics(
      diagnosticsDeliveryId,
      `${diagnosticsComponent}.Trigger`,
      'mount',
    );
    if (hasPreview) {
      logHistoryLayoutDiagnostics(
        diagnosticsDeliveryId,
        `${diagnosticsComponent}.Preview`,
        'mount',
      );
    }
    logHistoryLayoutDiagnostics(
      diagnosticsDeliveryId,
      `${diagnosticsComponent}.Host`,
      'mount',
    );
    logHistoryLayoutDiagnostics(
      diagnosticsDeliveryId,
      `${diagnosticsComponent}.RNHostView`,
      'mount',
    );
  }, [diagnosticsComponent, diagnosticsDeliveryId, hasPreview]);

  const actionButtons = actions.map((action) => (
    <Button
      key={action.id}
      label={action.title}
      modifiers={action.disabled ? [disabledModifier(true)] : undefined}
      onPress={action.onPress}
      role={action.destructive ? 'destructive' : undefined}
      systemImage={action.systemImage}
    />
  ));
  return (
    <Host
      ignoreSafeArea="all"
      matchContents
      onLayoutContent={({ nativeEvent }) => {
        logStartupDiagnostics(`${diagnosticsComponent}.host`, 'content-ready', {
          height: nativeEvent.height,
          width: nativeEvent.width,
        });
        if (diagnosticsDeliveryId) {
          logHistoryLayoutSize(
            diagnosticsDeliveryId,
            `${diagnosticsComponent}.Host/RNHostView`,
            nativeEvent,
          );
        }
      }}
      style={style as StyleProp<ViewStyle>}
    >
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents>
            <>{children}</>
          </RNHostView>
        </ContextMenu.Trigger>
        {preview ? (
          <ContextMenu.Preview>
            <RNHostView matchContents>
              <>{preview}</>
            </RNHostView>
          </ContextMenu.Preview>
        ) : null}
        <ContextMenu.Items>
          {title ? <Section title={title}>{actionButtons}</Section> : actionButtons}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}
