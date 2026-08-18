import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { Button, ContextMenu, Host, RNHostView, Section } from '@expo/ui/swift-ui';
import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type {
  NativeCardContextMenuAction,
  NativeCardContextMenuProps,
} from './NativeCardContextMenu.types';

const isNativeModuleAvailable = requireOptionalNativeModule('NativeCardContextMenu') !== null;
const NativeView: ComponentType<any> | null = isNativeModuleAvailable
  ? requireNativeView('NativeCardContextMenu')
  : null;

function renderAction(action: NativeCardContextMenuAction): ReactNode {
  return (
    <Button
      key={action.id}
      label={action.title}
      onPress={action.onPress}
      role={action.destructive ? 'destructive' : undefined}
      systemImage={action.systemImage}
    />
  );
}

export default function NativeCardContextMenu({
  actions,
  children,
  cornerRadius = 0,
  preview,
  style,
  title,
}: NativeCardContextMenuProps) {
  if (NativeView) {
    const rawActions = actions.map((action) => ({
      id: action.id,
      title: action.title,
      systemImage: action.systemImage,
      destructive: action.destructive ?? false,
      disabled: action.disabled ?? false,
    }));

    return (
      <NativeView
        actions={rawActions}
        cornerRadius={cornerRadius}
        onAction={({ nativeEvent }: { nativeEvent: { id: string } }) => {
          actions.find((action) => action.id === nativeEvent.id)?.onPress();
        }}
        style={style}
        title={title}
      >
        {children}
      </NativeView>
    );
  }

  const items = actions.map(renderAction);
  const body = title ? <Section title={title}>{items}</Section> : items;

  const trigger = (
    <RNHostView matchContents>
      <>{children}</>
    </RNHostView>
  );

  const previewNode = (
    <RNHostView matchContents>
      <>{preview ?? children}</>
    </RNHostView>
  );

  return (
    <Host ignoreSafeArea="all" matchContents style={style as StyleProp<ViewStyle>}>
      <ContextMenu>
        <ContextMenu.Trigger>{trigger}</ContextMenu.Trigger>
        <ContextMenu.Items>{body}</ContextMenu.Items>
        <ContextMenu.Preview>{previewNode}</ContextMenu.Preview>
      </ContextMenu>
    </Host>
  );
}
