import { Button, HStack, Host, Image, RNHostView, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint as accessibilityHintModifier,
  accessibilityLabel,
  accessibilityIdentifier,
  buttonStyle,
  contentShape,
  controlSize,
  frame,
  font,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { View } from 'react-native';

import { Avatar } from '@/components/feedback';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import {
  HOME_TOOLBAR_AVATAR_SIZE,
  HOME_TOOLBAR_CONTROL_SIZE,
  HOME_TOOLBAR_GAP,
  HOME_TOOLBAR_HORIZONTAL_PADDING,
  HOME_TOOLBAR_SEARCH_WIDTH,
  HOME_TOOLBAR_WIDTH,
} from './NativeHomeToolbarActions.constants';
import type { NativeHomeToolbarActionsProps } from './NativeHomeToolbarActions.types';

export default function NativeHomeToolbarActionsSwiftUI({
  mode = 'profileActions',
  accessibilityHint: profileHint,
  accessibilityLabel: profileLabel = 'Abrir perfil da conta',
  foregroundColor,
  imageUri,
  name,
  onProfilePress,
  onSearchPress,
  searchAccessibilityLabel = 'Abrir Pesquisa',
  searchAccessibilityHint = 'Abre a busca de produtos',
  showSearch = true,
}: NativeHomeToolbarActionsProps) {
  if (mode === 'searchAction') {
    return (
      <View
        accessible={false}
        collapsable={false}
        style={{ height: HOME_TOOLBAR_CONTROL_SIZE, width: HOME_TOOLBAR_SEARCH_WIDTH }}
        testID="home-toolbar-item:search:Busca:magnifyingglass:94x44"
      >
        <Host style={{ height: HOME_TOOLBAR_CONTROL_SIZE, width: HOME_TOOLBAR_SEARCH_WIDTH }}>
          <Button
            label="Busca"
            modifiers={[
              buttonStyle('plain'),
              controlSize('regular'),
              frame({
                width: HOME_TOOLBAR_SEARCH_WIDTH,
                height: HOME_TOOLBAR_CONTROL_SIZE,
                alignment: 'center',
              }),
              contentShape(shapes.rectangle()),
              accessibilityLabel(searchAccessibilityLabel),
              accessibilityHintModifier(searchAccessibilityHint),
              accessibilityIdentifier('home-search-toolbar'),
            ]}
            onPress={onSearchPress}
            systemImage="magnifyingglass"
          />
        </Host>
      </View>
    );
  }

  const toolbarWidth = showSearch ? HOME_TOOLBAR_WIDTH : HOME_TOOLBAR_CONTROL_SIZE;
  return (
    <Host style={{ height: HOME_TOOLBAR_CONTROL_SIZE, width: toolbarWidth }}>
      <HStack
        alignment="center"
        spacing={showSearch ? HOME_TOOLBAR_GAP : 0}
        modifiers={[
          padding({ leading: 0, trailing: showSearch ? HOME_TOOLBAR_HORIZONTAL_PADDING : 0 }),
          frame({
            width: toolbarWidth,
            height: HOME_TOOLBAR_CONTROL_SIZE,
            alignment: 'center',
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
            ...(profileHint ? [accessibilityHintModifier(profileHint)] : []),
            accessibilityLabel(profileLabel),
          ]}
          onPress={() => {
            triggerNativeButtonHaptic('light');
            onProfilePress?.();
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
        {showSearch ? (
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
        ) : null}
      </HStack>
    </Host>
  );
}
