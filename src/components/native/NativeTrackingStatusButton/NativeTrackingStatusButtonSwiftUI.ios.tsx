import { useEffect } from 'react';
import { PlatformColor } from 'react-native';
import { Button, Host, HStack, Image, Text, useNativeState } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  glassEffect,
  padding,
  symbolEffect,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/theme';
import { roundedFont } from '../nativeTypography';
import type { NativeTrackingStatusButtonProps } from './NativeTrackingStatusButton.types';

export default function NativeTrackingStatusButtonSwiftUI({
  accessibilityLabel: accessibilityText,
  active,
  activeLabel = 'Ao vivo',
  activeSystemImage = 'circle.fill',
  busy = false,
  color,
  containerHeight = 56,
  containerWidth = 132,
  disabled = false,
  idleLabel = 'Iniciar',
  idleSystemImage = 'circle',
  onPress,
  style,
}: NativeTrackingStatusButtonProps) {
  const { theme } = useAppTheme();
  const isTrackingActive = useNativeState<boolean>(active);

  useEffect(() => {
    if (isTrackingActive.get() !== active) {
      isTrackingActive.set(active);
    }
  }, [active, isTrackingActive]);

  const isDisabled = disabled || busy;
  const labelText = active ? activeLabel : idleLabel;
  const systemName = (active ? activeSystemImage : idleSystemImage) as SFSymbol;
  const indicatorColor = active
    ? (PlatformColor('systemGreen') as unknown as string)
    : (PlatformColor('secondaryLabel') as unknown as string);
  const textColor = color ?? theme.colors.textPrimary;
  const a11yLabel = accessibilityText ?? (active ? 'Parar rastreamento' : 'Iniciar rastreamento');

  return (
    <Host matchContents style={style}>
      <Button
        modifiers={[
          padding({ all: 0 }),
          buttonStyle('plain'),
          controlSize('regular'),
          ...(isDisabled ? [disabledModifier(true)] : []),
          frame({ width: containerWidth, height: containerHeight }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
          ...(color ? [tint(color)] : []),
          accessibilityLabel(a11yLabel),
        ]}
        onPress={onPress}
      >
        <HStack alignment="center" spacing={9}>
          <Image
            color={indicatorColor}
            modifiers={[
              frame({ width: 18, height: 18 }),
              symbolEffect({ effect: 'breathe' }, { isActive: isTrackingActive }),
            ]}
            size={16}
            systemName={systemName}
          />
          <Text modifiers={[roundedFont({ size: 18, weight: 'semibold' }), tint(textColor)]}>
            {labelText}
          </Text>
        </HStack>
      </Button>
    </Host>
  );
}
