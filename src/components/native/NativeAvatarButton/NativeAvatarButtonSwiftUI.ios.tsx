import { Button, Host, RNHostView } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { Avatar } from '@/components/feedback';
import type { NativeAvatarButtonProps } from '@/types/native-ui';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

const DEFAULT_CONTAINER_SIZE = 44;

export default function NativeAvatarButtonSwiftUI({
  accessibilityHint: hint,
  accessibilityLabel: accessibilityText,
  avatarSize = 'medium',
  containerSize = DEFAULT_CONTAINER_SIZE,
  disabled = false,
  glassTint,
  haptic = 'light',
  imageUri,
  name,
  onPress,
  style,
}: NativeAvatarButtonProps) {
  return (
    <Host matchContents style={style}>
      <Button
        modifiers={[
          padding({ all: 0 }),
          buttonStyle('plain'),
          controlSize('regular'),
          frame({ width: containerSize, height: containerSize }),
          glassEffect({
            glass: { interactive: true, tint: glassTint, variant: 'regular' },
            shape: 'circle',
          }),
          ...(disabled ? [disabledModifier(true)] : []),
          ...(hint ? [accessibilityHint(hint)] : []),
          accessibilityLabel(accessibilityText),
        ]}
        onPress={() => {
          if (disabled) return;
          triggerNativeButtonHaptic(haptic);
          onPress();
        }}
      >
        <RNHostView matchContents>
          <Avatar imageUri={imageUri ?? undefined} name={name} size={avatarSize} />
        </RNHostView>
      </Button>
    </Host>
  );
}
