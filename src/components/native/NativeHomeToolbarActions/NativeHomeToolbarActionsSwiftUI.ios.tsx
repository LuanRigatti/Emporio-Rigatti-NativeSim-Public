import { Button, HStack, Host, Image, RNHostView, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  buttonStyle,
  contentShape,
  controlSize,
  frame,
  font,
  glassEffect,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { Avatar } from '@/components/feedback';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import {
  HOME_TOOLBAR_AVATAR_SIZE,
  HOME_TOOLBAR_CONTROL_SIZE,
  HOME_TOOLBAR_GAP,
  HOME_TOOLBAR_HORIZONTAL_PADDING,
  HOME_TOOLBAR_WIDTH,
} from './NativeHomeToolbarActions.constants';
import type { NativeHomeToolbarActionsProps } from './NativeHomeToolbarActions.types';

export default function NativeHomeToolbarActionsSwiftUI({
  accessibilityHint: profileHint,
  accessibilityLabel: profileLabel = 'Abrir perfil da conta',
  foregroundColor,
  glassTint,
  imageUri,
  name,
  onProfilePress,
  onSearchPress,
  searchAccessibilityLabel = 'Abrir Pesquisa',
}: NativeHomeToolbarActionsProps) {
  return (
    <Host style={{ height: HOME_TOOLBAR_CONTROL_SIZE, width: HOME_TOOLBAR_WIDTH }}>
      <HStack
        alignment="center"
        spacing={HOME_TOOLBAR_GAP}
        modifiers={[
          padding({ horizontal: HOME_TOOLBAR_HORIZONTAL_PADDING }),
          frame({
            width: HOME_TOOLBAR_WIDTH,
            height: HOME_TOOLBAR_CONTROL_SIZE,
            alignment: 'center',
          }),
          glassEffect({
            glass: { interactive: true, tint: glassTint, variant: 'regular' },
            shape: 'capsule',
          }),
        ]}
      >
        <Button
          modifiers={[
            padding({ all: 0 }),
            buttonStyle('plain'),
            controlSize('regular'),
            frame({
              width: HOME_TOOLBAR_CONTROL_SIZE,
              height: HOME_TOOLBAR_CONTROL_SIZE,
              alignment: 'center',
            }),
            contentShape(shapes.rectangle()),
            ...(profileHint ? [accessibilityHint(profileHint)] : []),
            accessibilityLabel(profileLabel),
          ]}
          onPress={() => {
            triggerNativeButtonHaptic('light');
            onProfilePress();
          }}
        >
          <ZStack
            alignment="center"
            modifiers={[
              frame({ width: HOME_TOOLBAR_CONTROL_SIZE, height: HOME_TOOLBAR_CONTROL_SIZE }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <RNHostView matchContents>
              <Avatar
                dimension={HOME_TOOLBAR_AVATAR_SIZE}
                imageUri={imageUri ?? undefined}
                name={name}
                size="medium"
              />
            </RNHostView>
          </ZStack>
        </Button>
        <Button
          modifiers={[
            padding({ all: 0 }),
            buttonStyle('plain'),
            controlSize('regular'),
            frame({
              width: HOME_TOOLBAR_CONTROL_SIZE,
              height: HOME_TOOLBAR_CONTROL_SIZE,
              alignment: 'center',
            }),
            contentShape(shapes.rectangle()),
            accessibilityLabel(searchAccessibilityLabel),
          ]}
          onPress={onSearchPress}
        >
          <ZStack
            alignment="center"
            modifiers={[
              frame({ width: HOME_TOOLBAR_CONTROL_SIZE, height: HOME_TOOLBAR_CONTROL_SIZE }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <Image
              color={foregroundColor}
              modifiers={[font({ size: 21, weight: 'semibold' })]}
              systemName="magnifyingglass"
            />
          </ZStack>
        </Button>
      </HStack>
    </Host>
  );
}
